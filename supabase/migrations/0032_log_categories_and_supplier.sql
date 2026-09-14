-- 0032_log_categories_and_supplier.sql — une intervention porte plusieurs systèmes (D114).
--
-- « Vidange + changement d'anode + contrôle du gréement » est une seule visite du mécanicien et
-- une seule facture, mais trois systèmes du bateau. La colonne unique obligeait à choisir le
-- moins faux des trois, et la ligne ressortait ensuite sous un seul filtre.
--
-- Ce que la migration ajoute : une table de liaison `maintenance_log_categories`. Ce qu'elle ne
-- change pas : `maintenance_logs.category_id`, qui reste le **système principal** — le premier
-- coché — et continue de porter les filtres, le rapport, l'export et les vues qui existent. La
-- table de liaison porte *tous* les systèmes, le principal compris ; rien n'a donc à choisir
-- entre les deux lectures, et une ligne écrite par un import qui ne connaît que la colonne
-- reste correctement classée (la vue retombe sur elle quand la liaison est vide).
--
-- Sécurité en base (règle 2) : la liaison suit exactement les droits de l'intervention qu'elle
-- décrit — membre pour lire, `contribute` pour ajouter, `write` (ou le pro sur *ses* lignes)
-- pour retirer. Il n'y a pas de politique UPDATE, et c'est voulu : une liaison ne se modifie
-- pas, elle s'ajoute ou se retire, et `saveLog` réécrit l'ensemble à chaque enregistrement.

-- ---------------------------------------------------------------------------------------------
-- 1. La liaison
-- ---------------------------------------------------------------------------------------------
create table if not exists public.maintenance_log_categories (
  log_id      uuid not null references public.maintenance_logs (id) on delete cascade,
  category_id uuid not null references public.boat_categories (id) on delete cascade,
  -- Redondant avec `maintenance_logs.boat_id`, et indispensable : c'est la colonne que lisent
  -- `is_boat_member` et ses sœurs (règle 4). La contrainte ci-dessous interdit qu'elle mente.
  boat_id     uuid not null references public.boats (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (log_id, category_id)
);

comment on table public.maintenance_log_categories is
  'Les systèmes d''une intervention (D114). Le principal reste maintenance_logs.category_id ; cette table les porte tous, lui compris.';

create index if not exists maintenance_log_categories_boat_idx
  on public.maintenance_log_categories (boat_id, category_id);

-- Le bateau de la liaison est celui de l'intervention et celui du système : une ligne qui
-- mélangerait deux bateaux passerait sous les politiques du mauvais (règle 4).
create or replace function public.maintenance_log_categories_check_boat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  log_boat uuid;
  category_boat uuid;
begin
  select boat_id into log_boat from public.maintenance_logs where id = new.log_id;
  select boat_id into category_boat from public.boat_categories where id = new.category_id;
  if log_boat is distinct from new.boat_id or category_boat is distinct from new.boat_id then
    raise exception 'maintenance_log_categories: boat mismatch' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.maintenance_log_categories_check_boat() from public, authenticated, anon;

drop trigger if exists maintenance_log_categories_boat on public.maintenance_log_categories;
create trigger maintenance_log_categories_boat
  before insert or update on public.maintenance_log_categories
  for each row execute function public.maintenance_log_categories_check_boat();

-- ---------------------------------------------------------------------------------------------
-- 2. Les lignes déjà écrites gardent leur système, désormais aussi dans la liaison
-- ---------------------------------------------------------------------------------------------
insert into public.maintenance_log_categories (log_id, category_id, boat_id, created_by)
select l.id, l.category_id, l.boat_id, l.created_by
  from public.maintenance_logs l
 where l.category_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 3. RLS : les droits de l'intervention, à la lettre
-- ---------------------------------------------------------------------------------------------
alter table public.maintenance_log_categories enable row level security;

create policy "maintenance_log_categories_select" on public.maintenance_log_categories
  for select to authenticated
  using (public.is_boat_member(boat_id));

create policy "maintenance_log_categories_insert" on public.maintenance_log_categories
  for insert to authenticated
  with check (public.can_contribute_boat(boat_id) and created_by = auth.uid());

-- Le retrait suit la ligne, pas la liaison : un pro corrige les systèmes de *son* intervention
-- même si un editor les avait cochés pour lui.
create policy "maintenance_log_categories_delete" on public.maintenance_log_categories
  for delete to authenticated
  using (
    public.can_write_boat(boat_id)
    or (
      public.boat_role(boat_id) = 'pro'
      and exists (
        select 1 from public.maintenance_logs l
         where l.id = log_id and l.created_by = auth.uid()
      )
    )
  );

grant select, insert, delete on public.maintenance_log_categories to authenticated;
grant all on public.maintenance_log_categories to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. La vue dit les systèmes, sans cesser de dire le principal
-- ---------------------------------------------------------------------------------------------
create or replace view public.maintenance_logs_view
with (security_invoker = true) as
select
  l.id,
  l.boat_id,
  l.title,
  l.category_id,
  cat.name as category_name,
  cat.color as category_color,
  cat.is_active as category_is_active,
  l.status,
  l.performed_at,
  l.cost,
  l.currency,
  l.contact_id,
  ct.name as contact_name,
  l.equipment_id,
  eq.name as equipment_name,
  l.haul_out_id,
  l.notes,
  l.needs_review,
  l.pending_engine_hours,
  l.external_ref,
  l.created_by,
  coalesce(p.full_name, p.email) as created_by_name,
  l.updated_by,
  l.created_at,
  l.updated_at,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('engine_id', r.engine_id, 'label', e.label, 'hours', r.hours) order by e.sort_order)
      from public.engine_hour_readings r
      join public.engines e on e.id = r.engine_id
      where r.maintenance_log_id = l.id
    ),
    '[]'::jsonb
  ) as engine_hours,
  (select count(*)::int from public.checklist_completions cc where cc.maintenance_log_id = l.id) as completions_count,
  (
    select count(*)::int from public.attachments a
    where a.entity_type = 'maintenance_log' and a.entity_id = l.id and a.deleted_at is null
  ) as attachments_count,
  (select count(*)::int from public.purchases pu where pu.maintenance_log_id = l.id and pu.deleted_at is null) as purchases_count,
  -- Tous les systèmes, principal compris, dans l'ordre du bateau. Une ligne sans liaison —
  -- un import, une ligne d'avant cette migration — retombe sur sa seule colonne.
  coalesce(
    (
      select array_agg(c.id order by c.sort_order, c.name)
        from public.maintenance_log_categories lc
        join public.boat_categories c on c.id = lc.category_id
       where lc.log_id = l.id
    ),
    array_remove(array[l.category_id], null)
  ) as category_ids
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.contacts ct on ct.id = l.contact_id
left join public.equipment eq on eq.id = l.equipment_id
left join public.profiles p on p.id = l.created_by
where l.deleted_at is null;

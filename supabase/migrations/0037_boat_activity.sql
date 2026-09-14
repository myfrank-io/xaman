-- 0037_boat_activity.sql — E18-3 / D128: le fil du carnet, ce qui a eu lieu.
--
-- Le tableau de bord montrait trois résumés d'autres onglets ; ils sont partis avec E18-1, et ce
-- qui manquait à leur place est la seule chose qu'un carnet partagé sait faire et que le papier
-- ne sait pas : dire **ce que les autres ont fait depuis la dernière fois**.
--
-- Une vue, cinq faits, aucune table. `security_invoker` : la RLS de chaque table source décide,
-- exactement comme sur l'écran où le fait se montre déjà. Un étranger lit un fil vide.
--
-- Ce que le fil ne montre pas (D128) : les mises à la corbeille et les modifications. Ce n'est
-- pas un journal d'audit, c'est ce que le bateau a vécu — une ligne à la corbeille en sort comme
-- elle sort des listes.

create or replace view public.boat_activity
with (security_invoker = true) as

  -- un point coché
  select
    cc.boat_id,
    'completion'::text as kind,
    cc.id,
    cc.completed_at as happened_at,
    ci.label as title,
    -- le nom figé d'abord (D31) : il survit à la suppression du compte qui l'a écrit
    coalesce(nullif(btrim(cc.completed_by_name), ''), p.full_name, p.email) as who,
    cat.name as category_name,
    cat.color as category_color,
    null::numeric as amount,
    cc.engine_hours as hours,
    cc.created_at as recorded_at
  from public.checklist_completions cc
  join public.checklist_items ci on ci.id = cc.checklist_item_id
  left join public.boat_categories cat on cat.id = ci.category_id
  left join public.profiles p on p.id = cc.completed_by

  union all

  -- une intervention terminée
  select
    l.boat_id,
    'log',
    l.id,
    l.performed_at,
    l.title,
    coalesce(c.name, p.full_name, p.email),
    cat.name,
    cat.color,
    l.cost,
    null,
    l.created_at
  from public.maintenance_logs l
  left join public.contacts c on c.id = l.contact_id
  left join public.boat_categories cat on cat.id = l.category_id
  left join public.profiles p on p.id = l.created_by
  where l.deleted_at is null and l.status = 'done'

  union all

  -- un achat
  select
    pu.boat_id,
    'purchase',
    pu.id,
    pu.purchased_at,
    pu.designation,
    coalesce(c.name, p.full_name, p.email),
    cat.name,
    cat.color,
    pu.amount,
    null,
    pu.created_at
  from public.purchases pu
  left join public.contacts c on c.id = pu.supplier_contact_id
  left join public.boat_categories cat on cat.id = pu.category_id
  left join public.profiles p on p.id = pu.created_by
  where pu.deleted_at is null

  union all

  -- un relevé d'heures saisi à la main. Ceux que l'application dérive d'une intervention ou d'un
  -- cochage (D5) ne sont pas un acte de plus : leur ligne est déjà au-dessus.
  select
    r.boat_id,
    'reading',
    r.id,
    r.read_at,
    e.label,
    coalesce(p.full_name, p.email),
    null,
    null,
    null,
    r.hours,
    r.created_at
  from public.engine_hour_readings r
  join public.engines e on e.id = r.engine_id
  left join public.profiles p on p.id = r.created_by
  where r.source = 'manual'

  union all

  -- une sortie de l'eau
  select
    h.boat_id,
    'haul_out',
    h.id,
    h.started_at,
    coalesce(nullif(btrim(h.yard_name), ''), c.name),
    coalesce(c.name, p.full_name, p.email),
    null,
    null,
    h.cost,
    null,
    h.created_at
  from public.haul_outs h
  left join public.contacts c on c.id = h.yard_contact_id
  left join public.profiles p on p.id = h.created_by
  where h.deleted_at is null;

comment on view public.boat_activity is
  'The carnet''s shared feed (D128): what happened — points ticked, interventions done, purchases, manual hour readings, haul-outs — newest first, with who did it. Facts only: nothing here says what was trashed or edited. security_invoker, so each source table''s RLS decides.';

grant select on public.boat_activity to authenticated, service_role;
revoke all on public.boat_activity from anon;

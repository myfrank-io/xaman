-- 0030_expense_totals.sql — les totaux de l'écran Dépenses, comptés par la base (D111).
--
-- L'écran lisait **toutes** les lignes de dépense du bateau pour n'en afficher que vingt : la
-- pagination était un `slice(0, 20)` en TypeScript, posé derrière une requête sans `limit`.
-- Le total, la répartition par système, le nombre de lignes, le cumul depuis l'origine et la
-- période précédente se calculaient tous sur ce tableau complet — donc le tableau complet
-- devait arriver. Sur un carnet papier repris (des années d'interventions, d'achats et de
-- sorties de l'eau), c'est quelques centaines de kilo-octets par ouverture, sur l'écran que
-- Xav ouvre depuis un iPad au mouillage.
--
-- Poser un `limit` sans rien d'autre aurait été pire que le mal : les totaux se seraient mis à
-- ne compter que la page. « 1 850 € » serait devenu « 1 850 € des vingt dernières lignes »,
-- sans que rien à l'écran ne le dise. Un chiffre faux est plus coûteux qu'un chiffre lent.
--
-- Cette fonction rend donc, en une lecture, ce que l'écran affichait en additionnant des
-- lignes : le total et le nombre de lignes de la sélection, sa répartition par système, le
-- cumul de toutes les sources retenues et la date de la première dépense, et le total de la
-- période précédente. La liste peut alors demander sa page, et seulement sa page.
--
-- Sécurité (règle 2) : `security invoker` (le défaut, jamais `definer`) sur la vue
-- `expenses_by_category`, elle-même en `security_invoker = true`. La RLS de la personne
-- connectée s'applique donc exactement comme sur la lecture qu'elle remplace : un `viewer`
-- d'un autre bateau qui appelle la fonction avec un `p_boat_id` qui n'est pas le sien lit zéro
-- ligne, pas une erreur — `tests/unit/rls.test.ts` le vérifie.

create or replace function public.boat_expense_totals(
  p_boat_id uuid,
  p_from date,
  p_to date,
  p_sources text[],
  p_kind public.purchase_kind default null,
  -- Trois états, pas deux : un système donné, « Sans catégorie » (`p_uncategorized`), ou tout.
  p_category uuid default null,
  p_uncategorized boolean default false,
  -- Absentes sur « Toute la période » : il n'y a pas de période d'avant l'origine.
  p_previous_from date default null,
  p_previous_to date default null
)
returns table (
  total numeric,
  line_count bigint,
  previous_total numeric,
  cumulative_total numeric,
  first_date date,
  by_category jsonb
)
language sql
stable
set search_path = ''
as $$
  with visible as (
    -- Le cumul, la première dépense et la période précédente ne suivent aucun filtre de
    -- l'écran sauf les sources : c'est ce que la page affichait déjà, et ce que « depuis le
    -- 12/03/2019 » veut dire sous la carte du cumul.
    select e.category_id, e.category_name, e.category_color, e.amount, e.date, e.purchase_kind
    from public.expenses_by_category e
    where e.boat_id = p_boat_id
      and e.source = any(p_sources)
  ),
  filtered as (
    select v.*
    from visible v
    where v.date >= p_from
      and v.date <= p_to
      and (p_kind is null or v.purchase_kind = p_kind)
      and (
        case
          when p_uncategorized then v.category_id is null
          when p_category is null then true
          else v.category_id = p_category
        end
      )
  ),
  grouped as (
    select
      f.category_id,
      max(f.category_name) as category_name,
      max(f.category_color) as category_color,
      sum(f.amount) as amount,
      count(*) as count
    from filtered f
    group by f.category_id
  )
  select
    coalesce((select sum(f.amount) from filtered f), 0)::numeric as total,
    (select count(*) from filtered f) as line_count,
    coalesce(
      (
        select sum(v.amount) from visible v
        where p_previous_from is not null
          and p_previous_to is not null
          and v.date >= p_previous_from
          and v.date <= p_previous_to
      ),
      0
    )::numeric as previous_total,
    coalesce((select sum(v.amount) from visible v), 0)::numeric as cumulative_total,
    (select min(v.date) from visible v) as first_date,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category_id', g.category_id,
            'category_name', g.category_name,
            'category_color', g.category_color,
            'amount', g.amount,
            'count', g.count
          )
          -- Le même ordre que la barre à l'écran : le plus gros système d'abord, puis le nom,
          -- pour que deux montants égaux ne changent pas de place d'une lecture à l'autre.
          order by g.amount desc, g.category_name asc nulls last
        )
        from grouped g
      ),
      '[]'::jsonb
    ) as by_category;
$$;

comment on function public.boat_expense_totals(
  uuid, date, date, text[], public.purchase_kind, uuid, boolean, date, date
) is
  'Totaux de l''écran Dépenses (D111) : total et nombre de lignes de la sélection, répartition '
  'par système, cumul et première dépense sur les sources retenues, total de la période '
  'précédente. Permet à la liste de ne demander que sa page sans fausser un seul chiffre.';

grant execute on function public.boat_expense_totals(
  uuid, date, date, text[], public.purchase_kind, uuid, boolean, date, date
) to authenticated, service_role;

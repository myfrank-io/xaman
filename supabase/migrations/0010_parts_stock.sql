-- 0010_parts_stock.sql — E5-4 / D10: the declarative stock of spare parts.
--   1. parts.checked_at — the day the line was last counted or adjusted (« vérifié il y a N mois »).
--   2. adjust_part_quantity() — atomic +/− from the list: two taps in a row never lose an
--      increment, the quantity floors at 0 and the tap counts as a check. security invoker,
--      so the parts_update policy (can_write_boat) decides who may call it: a viewer or a pro
--      updates no row and gets part_not_found.

alter table public.parts add column if not exists checked_at date;
comment on column public.parts.checked_at is
  'Last day the quantity was counted or adjusted (D10); null = never checked.';

create or replace function public.adjust_part_quantity(p_part_id uuid, p_delta numeric)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_quantity numeric;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;
  update public.parts
    set quantity = greatest(0, quantity + p_delta),
        checked_at = current_date,
        updated_by = auth.uid()
    where id = p_part_id
    returning quantity into v_quantity;
  if not found then
    raise exception 'part_not_found' using errcode = 'P0002';
  end if;
  return v_quantity;
end;
$$;

comment on function public.adjust_part_quantity(uuid, numeric) is
  'Atomic +/− on a part of the stock (floored at 0), the line counting as checked today.';

revoke all on function public.adjust_part_quantity(uuid, numeric) from public, anon;
grant execute on function public.adjust_part_quantity(uuid, numeric) to authenticated, service_role;

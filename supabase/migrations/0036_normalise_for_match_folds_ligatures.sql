-- 0036_normalise_for_match_folds_ligatures.sql — one accent table, not two (E17-12).
--
-- What was wrong
-- --------------
-- `0035` gave `normalise_for_match()` an accent table of its own:
--
--     translate(…, 'ÀÁÂÃÄÅÇÈÉ…', 'AAAAAACEE…')
--
-- `public.text_fold()` has been doing that same job since `0005`, and doing it better: it folds
-- `Œ œ Æ æ` to `OE oe AE ae` and knows `Ø ø`, which the newer table does not. So the repository
-- held two accent tables for one question, and the one written last was the weaker — which is how
-- a pair of them drifts.
--
-- The drift was not theoretical. `œ` is absent from the `0035` table, so it survived `translate`
-- and was then swallowed by the `[^a-z0-9&]` step as if it were punctuation:
--
--     normalise_for_match('Cœur')  ->  'c ur'      -- and via text_fold: 'coeur'
--
-- A rule narrowed to a brand spelled with a ligature would have compared equal to any other brand
-- reduced to the same stump.
--
-- What this does
-- --------------
-- `normalise_for_match` keeps its signature, its `immutable`, its empty `search_path` and its
-- privileges, and becomes what it should have been: `text_fold` plus the one thing it adds — the
-- punctuation of a written name turned into spaces. `&` stays a word of its own, so « B&G »
-- survives as `b & g` rather than becoming `bg`.
--
-- `create or replace` keeps the ACL `0035` set; the grants are restated below anyway, so this
-- file says what it leaves behind rather than relying on what came before.
--
-- Its TypeScript twin, `normaliseForMatch` (`src/lib/equipment-kinds.ts`), learns the same three
-- ligatures in the same commit: it folds with `normalize("NFD")`, which does not decompose
-- `œ æ ø` — they are letters in their own right, not accented ones — so it had the same blind
-- spot for a different reason. `tests/unit/plan-composition.test.ts` now runs both sides over
-- ligature samples.

create or replace function public.normalise_for_match(p_value text)
returns text
language sql immutable
set search_path = ''
as $$
  select trim(regexp_replace(public.text_fold(p_value), '[^a-z0-9&]+', ' ', 'g'));
$$;

comment on function public.normalise_for_match(text) is
  'Lower-case, unaccented (via public.text_fold, ligatures included), punctuation to spaces — the '
  'SQL twin of normaliseForMatch in src/lib/equipment-kinds.ts (E17-5, E17-12). Kept at parity by '
  'tests/unit/plan-composition.test.ts.';

-- Same as `0035` said: nothing anonymous executes anything here.
revoke execute on function public.normalise_for_match(text) from public, anon;
grant execute on function public.normalise_for_match(text) to authenticated, service_role;

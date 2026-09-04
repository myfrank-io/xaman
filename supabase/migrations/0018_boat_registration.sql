-- 0018_boat_registration.sql — the boat's registration number on the identity card.
--
-- What it is and is not
-- ---------------------
-- `registration` is the number the maritime administration issued to the boat (the French
-- « immatriculation » delivered by the Affaires maritimes, or its foreign equivalent). It is not
-- `hull_number`, which is the yard's own serial — Xaman is hull #25 of its series — and not
-- `sail_number`, which is what is painted on the mainsail. A boat can carry all three, and a
-- harbour master, an insurer or a customs officer asks for this one.
--
-- Free text on purpose. There is no reference list to validate against: the format changed with
-- the 2016 reform, boats registered before it keep their old number, published lists of quartiers
-- maritimes disagree with each other (45 or 47 depending on the source), and a boat under a
-- foreign flag follows another country's rules entirely. `src/lib/boat-registration.ts` warns
-- when what was typed does not look like the current French shape; it never refuses it.
--
-- No automatic lookup, and none coming. The French registry (PUMA, arrêté du 27 octobre 2025) is
-- internal to the Affaires maritimes: no API, no open data, no public consultation. Nothing maps
-- a registration to a builder and a model, so this column is what someone types, full stop.
--
-- Personal data. A registration stored next to an identified account identifies its holder
-- trivially, so it stays behind the same RLS as the rest of the boat — visible to the boat's
-- members and to nobody else. No column privilege is revoked: under PostgREST a revoked column
-- makes the whole request fail rather than hide the value, which would break every screen that
-- selects the boat. RLS is the protection here, and it is the right one.

alter table public.boats add column registration text;

comment on column public.boats.registration is
  'Registration number issued by the maritime administration (FR: immatriculation). Free text: '
  'no reference list to validate against, and no registry exposes a lookup. Distinct from '
  'hull_number (the yard serial) and sail_number.';

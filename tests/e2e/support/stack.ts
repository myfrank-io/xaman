/**
 * E2E journeys (E9-3) need a live Supabase stack — Auth and PostgREST, not just Postgres —
 * because they sign a real user in and write real rows. That stack is `supabase start`, which
 * needs Docker; CI has it, and a laptop has it, but the remote development sandbox does not
 * (see E0-2). So the journeys announce their own prerequisite instead of failing obscurely:
 * when the environment is not wired up they are skipped, and `pnpm test:e2e` still runs the
 * touch audit on its own.
 *
 * D76: they never point at the production project. These specs create interventions, tick
 * checklist items and invite members; run against `xaman` they would write test data into
 * Xavier's real log.
 */
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "";
export const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True when both halves of the stack contract are present. */
export const hasStack = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

export const skipReason =
  "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set: needs `supabase start` (Docker).";

/**
 * The seed of `supabase/seed.sql`, which exists for the RLS tests and for these journeys. Ids
 * are fixed there, so the journeys never have to discover them.
 */
export const SEED = {
  boat: "00000000-0000-0000-0000-00000000b001",
  /** The dashboard's h1 is the boat, not the page: the screen says where you are, not what it is. */
  boatName: "Bateau test",
  category: "Moteurs",
  item: "Vidange huile moteur — Moteur",
  users: {
    owner: "owner@test.xaman",
    editor: "editor@test.xaman",
    pro: "pro@test.xaman",
    viewer: "viewer@test.xaman",
  },
} as const;

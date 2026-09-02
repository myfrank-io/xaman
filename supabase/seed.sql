-- Development / CI seed ONLY (never production): 6 users, a test boat with one row per table
-- and a second boat owned by an outsider, for the RLS tests (tests/unit/rls.test.ts) and E2E.
-- Real Xaman data is loaded by `pnpm seed:xaman` (scripts/seed.ts).

-- Users -----------------------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Test"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Olivia Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Émile Editor"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Paul Pro"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Vera Viewer"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@test.xaman', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Stranger"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000010';

-- Template ---------------------------------------------------------------------------------------
insert into public.checklist_templates (id, name, builder, model, boat_type, external_ref)
values ('00000000-0000-0000-0000-0000000000a0', 'Modèle test', 'Test', 'T1', 'monohull_sail', 'test-v1')
on conflict (id) do nothing;
insert into public.checklist_template_categories (id, template_id, name, color, icon, sort_order, external_ref)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a0', 'Moteurs', '#D97706', 'cog', 1, 'engines')
on conflict (id) do nothing;
insert into public.checklist_template_items (id, template_category_id, label, interval_months, interval_hours, engine_scope, external_ref)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Vidange huile moteur', 12, 250, 'inboard', 'eng-oil')
on conflict (id) do nothing;

-- Boat 1: the test boat ------------------------------------------------------------------------
insert into public.boats (id, name, builder, model, type, checklist_template_id, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000b001', 'Bateau test', 'Test', 'T1', 'monohull_sail', '00000000-0000-0000-0000-0000000000a0', 'test-boat', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.boat_members (boat_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000011', 'owner'),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000012', 'editor'),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000013', 'pro'),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000000014', 'viewer')
on conflict do nothing;

insert into public.boat_invitations (id, boat_id, email, role, token, invited_by)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'stranger@test.xaman', 'viewer', 'test-token-secret-000000000000000000000000001', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.engines (id, boat_id, label, position, brand, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b001', 'Moteur', 'center', 'Test', 'test-engine', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.boat_categories (id, boat_id, name, color, icon, sort_order, template_category_id, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000b001', 'Moteurs', '#D97706', 'cog', 1, '00000000-0000-0000-0000-0000000000a1', 'engines', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.contacts (id, boat_id, name, specialty, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001', 'Chantier test', 'Chantier carénage', 'test-yard', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.equipment (id, boat_id, category_id, name, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000ca01', 'Équipement test', 'test-equipment', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.haul_outs (id, boat_id, started_at, ended_at, yard_contact_id, external_ref, created_by)
values ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-00000000b001', '2026-01-10', '2026-01-20', '00000000-0000-0000-0000-00000000d001', 'test-haul-out', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

-- maintenance logs: one by the owner, one by the pro
insert into public.maintenance_logs (id, boat_id, title, category_id, status, performed_at, cost, external_ref, created_by)
values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-00000000b001', 'Vidange (owner)', '00000000-0000-0000-0000-00000000ca01', 'done', '2026-03-01', 120, 'test-log-owner', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-00000000b001', 'Vidange (pro)', '00000000-0000-0000-0000-00000000ca01', 'done', '2026-04-01', 300, 'test-log-pro', '00000000-0000-0000-0000-000000000013')
on conflict (id) do nothing;

insert into public.checklist_items (id, boat_id, category_id, label, interval_months, interval_hours, engine_id, source, template_item_id, external_ref, created_by)
values ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000ca01', 'Vidange huile moteur — Moteur', 12, 250, '00000000-0000-0000-0000-00000000e001', 'template', '00000000-0000-0000-0000-0000000000a2', 'eng-oil:test-engine', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.checklist_completions (id, boat_id, checklist_item_id, completed_at, completed_by, engine_hours, maintenance_log_id, created_by)
values
  ('00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000003001', '2026-03-01', '00000000-0000-0000-0000-000000000011', 500, '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000004002', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-000000003001', '2026-04-01', '00000000-0000-0000-0000-000000000013', 600, '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000013')
on conflict (id) do nothing;

insert into public.engine_hour_readings (id, boat_id, engine_id, hours, read_at, source, maintenance_log_id, created_by)
values
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000e001', 500, '2026-03-01', 'maintenance_log', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000e001', 600, '2026-04-01', 'maintenance_log', '00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000013')
on conflict (id) do nothing;

insert into public.parts (id, boat_id, name, quantity, min_quantity, external_ref, created_by)
values ('00000000-0000-0000-0000-000000006001', '00000000-0000-0000-0000-00000000b001', 'Filtre à huile', 1, 2, 'test-part', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.purchases (id, boat_id, purchased_at, kind, designation, amount, category_id, external_ref, created_by)
values ('00000000-0000-0000-0000-000000007001', '00000000-0000-0000-0000-00000000b001', '2026-02-01', 'gas', 'Bouteille gaz', 35, '00000000-0000-0000-0000-00000000ca01', 'test-gas', '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.attachments (id, boat_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_by)
values ('00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-00000000b001', 'maintenance_log', '00000000-0000-0000-0000-000000002001', 'boats/00000000-0000-0000-0000-00000000b001/maintenance_log/00000000-0000-0000-0000-000000002001/test.jpg', 'test.jpg', 'image/jpeg', 1234, '00000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

-- Boat 2: owned by the outsider (tenant isolation) --------------------------------------------
insert into public.boats (id, name, type, external_ref, created_by)
values ('00000000-0000-0000-0000-00000000b002', 'Autre bateau', 'motor', 'other-boat', '00000000-0000-0000-0000-000000000015')
on conflict (id) do nothing;
insert into public.boat_members (boat_id, user_id, role)
values ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000015', 'owner')
on conflict do nothing;
insert into public.maintenance_logs (id, boat_id, title, status, performed_at, external_ref, created_by)
values ('00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-00000000b002', 'Intervention autre bateau', 'done', '2026-05-01', 'other-log', '00000000-0000-0000-0000-000000000015')
on conflict (id) do nothing;

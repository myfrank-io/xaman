-- 20261018150000_rls_initplan_and_fk_indexes.sql
--
-- Two fixes raised by the Supabase performance advisor, both of them real on the hosted
-- project (not theoretical): the app was reported "très très lente", and a cascade delete on
-- `boats` (an empty duplicate) was timing out.
--
-- 1. auth_rls_initplan: fifteen policies on the hottest tables (profiles, boat_members,
--    checklist_completions, engine_hour_readings, attachments, maintenance_logs, inbox_items,
--    maintenance_log_categories) call `auth.uid()` directly in their USING/WITH CHECK clause.
--    Postgres re-evaluates a bare `auth.uid()` once PER ROW scanned, not once per query —
--    wrapping it `(select auth.uid())` makes the planner cache it as an InitPlan, evaluated
--    once. This is the single highest-leverage fix available: it touches every read and write
--    the app does. `ALTER POLICY` rewrites each clause in place, nothing about who may do what
--    changes — same booleans, just not re-run per row.
--
-- 2. unindexed_foreign_keys: 54 foreign keys (mostly created_by/updated_by audit columns, and a
--    handful of category/contact/template references) have no covering index. Postgres does not
--    index FK columns automatically; without one, deleting (or updating the PK of) the
--    referenced row forces a sequential scan of the *referencing* table to check nothing is
--    orphaned — which is exactly what made deleting an empty duplicate boat time out: cascading
--    through `checklist_items` and `boat_categories` had to scan tables with no covering index
--    on the columns pointing back at them.
--
-- Neither changes what any role may read or write — RLS booleans and FK references are
-- unchanged, only how cheaply Postgres evaluates and checks them.

-- ---------------------------------------------------------------------------------------------
-- 1. auth_rls_initplan: auth.uid() wrapped in (select ...) wherever a policy calls it bare.
-- ---------------------------------------------------------------------------------------------
alter policy "attachments_insert" on public.attachments
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "attachments_update" on public.attachments
  using (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  )
  with check (
    public.can_write_boat(boat_id)
    or (
      (public.boat_role(boat_id) = 'pro'::public.boat_role)
      and (created_by = (select auth.uid()))
      and (deleted_at is null)
    )
  );

alter policy "boat_members_select" on public.boat_members
  using (public.can_write_boat(boat_id) or (user_id = (select auth.uid())));

alter policy "checklist_completions_delete" on public.checklist_completions
  using (
    public.can_write_boat(boat_id)
    or ((created_by = (select auth.uid())) and (created_at > (now() - interval '24:00:00')))
  );

alter policy "checklist_completions_insert" on public.checklist_completions
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "checklist_completions_update" on public.checklist_completions
  using (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  )
  with check (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  );

alter policy "engine_hour_readings_insert" on public.engine_hour_readings
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "engine_hour_readings_update" on public.engine_hour_readings
  using (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  )
  with check (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  );

alter policy "inbox_items_insert" on public.inbox_items
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "maintenance_log_categories_delete" on public.maintenance_log_categories
  using (
    public.can_write_boat(boat_id)
    or (
      (public.boat_role(boat_id) = 'pro'::public.boat_role)
      and exists (
        select 1 from public.maintenance_logs l
        where l.id = maintenance_log_categories.log_id and l.created_by = (select auth.uid())
      )
    )
  );

alter policy "maintenance_log_categories_insert" on public.maintenance_log_categories
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "maintenance_logs_insert" on public.maintenance_logs
  with check (public.can_contribute_boat(boat_id) and (created_by = (select auth.uid())));

alter policy "maintenance_logs_update" on public.maintenance_logs
  using (
    public.can_write_boat(boat_id)
    or ((public.boat_role(boat_id) = 'pro'::public.boat_role) and (created_by = (select auth.uid())))
  )
  with check (
    public.can_write_boat(boat_id)
    or (
      (public.boat_role(boat_id) = 'pro'::public.boat_role)
      and (created_by = (select auth.uid()))
      and ((deleted_at is null) or (created_at > (now() - interval '24:00:00')))
    )
  );

alter policy "profiles_select" on public.profiles
  using ((id = (select auth.uid())) or public.is_platform_admin() or public.shares_boat_with(id));

alter policy "profiles_update" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- 2. unindexed_foreign_keys: one covering index per flagged column (audit trail + a few
--    category/contact/template references). `if not exists` makes this re-runnable.
-- ---------------------------------------------------------------------------------------------
create index if not exists attachments_created_by_idx on public.attachments (created_by);
create index if not exists attachments_updated_by_idx on public.attachments (updated_by);

create index if not exists boat_categories_created_by_idx on public.boat_categories (created_by);
create index if not exists boat_categories_template_category_id_idx on public.boat_categories (template_category_id);
create index if not exists boat_categories_updated_by_idx on public.boat_categories (updated_by);

create index if not exists boat_members_invited_by_idx on public.boat_members (invited_by);

create index if not exists boats_checklist_template_id_idx on public.boats (checklist_template_id);
create index if not exists boats_created_by_idx on public.boats (created_by);
create index if not exists boats_organization_id_idx on public.boats (organization_id);
create index if not exists boats_updated_by_idx on public.boats (updated_by);

create index if not exists checklist_completions_completed_by_idx on public.checklist_completions (completed_by);
create index if not exists checklist_completions_created_by_idx on public.checklist_completions (created_by);
create index if not exists checklist_completions_updated_by_idx on public.checklist_completions (updated_by);

create index if not exists checklist_item_categories_category_id_idx on public.checklist_item_categories (category_id);

create index if not exists checklist_items_category_id_idx on public.checklist_items (category_id);
create index if not exists checklist_items_created_by_idx on public.checklist_items (created_by);
create index if not exists checklist_items_rule_id_idx on public.checklist_items (rule_id);
create index if not exists checklist_items_template_item_id_idx on public.checklist_items (template_item_id);
create index if not exists checklist_items_updated_by_idx on public.checklist_items (updated_by);

create index if not exists checklist_templates_created_by_idx on public.checklist_templates (created_by);
create index if not exists checklist_templates_owner_organization_id_idx on public.checklist_templates (owner_organization_id);

create index if not exists contacts_created_by_idx on public.contacts (created_by);
create index if not exists contacts_updated_by_idx on public.contacts (updated_by);

create index if not exists engine_hour_readings_created_by_idx on public.engine_hour_readings (created_by);
create index if not exists engine_hour_readings_updated_by_idx on public.engine_hour_readings (updated_by);

create index if not exists engines_created_by_idx on public.engines (created_by);
create index if not exists engines_updated_by_idx on public.engines (updated_by);

create index if not exists equipment_category_id_idx on public.equipment (category_id);
create index if not exists equipment_created_by_idx on public.equipment (created_by);
create index if not exists equipment_updated_by_idx on public.equipment (updated_by);

create index if not exists haul_outs_created_by_idx on public.haul_outs (created_by);
create index if not exists haul_outs_updated_by_idx on public.haul_outs (updated_by);
create index if not exists haul_outs_yard_contact_id_idx on public.haul_outs (yard_contact_id);

create index if not exists inbox_items_attachment_id_idx on public.inbox_items (attachment_id);
create index if not exists inbox_items_created_by_idx on public.inbox_items (created_by);
create index if not exists inbox_items_log_id_idx on public.inbox_items (log_id);
create index if not exists inbox_items_purchase_id_idx on public.inbox_items (purchase_id);
create index if not exists inbox_items_updated_by_idx on public.inbox_items (updated_by);
create index if not exists inbox_items_validated_by_idx on public.inbox_items (validated_by);

create index if not exists maintenance_log_categories_category_id_idx on public.maintenance_log_categories (category_id);
create index if not exists maintenance_log_categories_created_by_idx on public.maintenance_log_categories (created_by);

create index if not exists maintenance_logs_category_id_idx on public.maintenance_logs (category_id);
create index if not exists maintenance_logs_contact_id_idx on public.maintenance_logs (contact_id);
create index if not exists maintenance_logs_created_by_idx on public.maintenance_logs (created_by);
create index if not exists maintenance_logs_updated_by_idx on public.maintenance_logs (updated_by);

create index if not exists organization_members_user_id_idx on public.organization_members (user_id);

create index if not exists organizations_created_by_idx on public.organizations (created_by);

create index if not exists parts_category_id_idx on public.parts (category_id);
create index if not exists parts_created_by_idx on public.parts (created_by);
create index if not exists parts_supplier_contact_id_idx on public.parts (supplier_contact_id);
create index if not exists parts_updated_by_idx on public.parts (updated_by);

create index if not exists purchases_category_id_idx on public.purchases (category_id);
create index if not exists purchases_created_by_idx on public.purchases (created_by);
create index if not exists purchases_supplier_contact_id_idx on public.purchases (supplier_contact_id);
create index if not exists purchases_updated_by_idx on public.purchases (updated_by);

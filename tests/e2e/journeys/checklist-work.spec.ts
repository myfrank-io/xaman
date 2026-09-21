import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason, SUPABASE_URL, SERVICE_ROLE_KEY } from "../support/stack";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: "return=representation",
};
const categoryId = "00000000-0000-0000-0000-00000000ca01";
async function insert(request: APIRequestContext, table: string, data: Record<string, unknown>) {
  const response = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json())[0] as Record<string, unknown>;
}
async function point(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const id = randomUUID();
  const label = `E2E contrôle ${id.slice(0, 8)}`;
  await insert(request, "checklist_items", {
    id,
    boat_id: SEED.boat,
    category_id: categoryId,
    label,
    interval_months: 12,
    anchor_date: "2020-01-01",
    actions: ["Ouvrir le capot", "Vérifier les fixations"],
    ...extra,
  });
  return { id, label };
}
async function logs(request: APIRequestContext, id: string) {
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/maintenance_logs?boat_id=eq.${SEED.boat}&checklist_item_id=eq.${id}&deleted_at=is.null&select=id,performed_at,notes`,
    { headers },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; performed_at: string; notes: string | null }[];
}
async function enter(
  page: Page,
  request: APIRequestContext,
  label: string,
  view = "todo",
  email: string = SEED.users.owner,
) {
  await signIn(
    page,
    request,
    email,
    `/boats/${SEED.boat}/checklist?view=${view}&q=${encodeURIComponent(label)}`,
  );
}

test.describe("E4-13 working through the checklist", () => {
  test.skip(!hasStack, skipReason);

  test("quick tick is singular, stays in place, persists and can be undone on its row", async ({
    page,
    request,
  }) => {
    const item = await point(request);
    await enter(page, request, item.label);
    const line = page.locator(`[data-item-id="${item.id}"]`);
    const before = await line.boundingBox();
    await line.getByRole("checkbox").dblclick();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      line.getByRole("button", { name: fr.checklist.work.undo, exact: true }),
    ).toBeVisible();
    expect((await line.boundingBox())?.y).toBe(before?.y);
    expect(await logs(request, item.id)).toHaveLength(1);
    await line.getByRole("button", { name: fr.checklist.work.undo, exact: true }).tap();
    await expect(line.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
    expect(await logs(request, item.id)).toHaveLength(0);
    await line.getByRole("checkbox").tap();
    await expect(
      line.getByRole("button", { name: fr.checklist.work.undo, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: new RegExp(fr.checklist.work.filters.all) }).tap();
    await page.reload();
    await expect(line.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(await logs(request, item.id)).toHaveLength(1);
  });

  test("steps, historic date and note stay in the same workflow", async ({ page, request }) => {
    const item = await point(request);
    await enter(page, request, item.label, "all");
    const line = page.locator(`[data-item-id="${item.id}"]`);
    await line.getByRole("button", { name: new RegExp(item.label) }).tap();
    await line.getByRole("checkbox", { name: "1. Ouvrir le capot" }).check();
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.reload();
    await expect(line.getByRole("checkbox", { name: "1. Ouvrir le capot" })).toBeChecked();
    expect(browserErrors.filter((message) => /hydration/i.test(message))).toEqual([]);
    expect(await logs(request, item.id)).toHaveLength(0);
    await line.getByRole("button", { name: fr.checklist.work.otherDate, exact: true }).tap();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: fr.checklist.complete.date, exact: true })
      .fill("2026-01-15");
    await dialog
      .getByRole("textbox", { name: fr.checklist.complete.note, exact: true })
      .fill("Contrôle repris du carnet papier");
    await dialog.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(dialog).toBeHidden();
    const saved = await logs(request, item.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      performed_at: "2026-01-15",
      notes: "Contrôle repris du carnet papier",
    });
    await expect(
      line.getByRole("button", { name: fr.checklist.work.undo, exact: true }),
    ).toBeVisible();
    await line.getByRole("button", { name: fr.checklist.work.undo, exact: true }).tap();
    await expect(
      line.getByRole("button", { name: fr.checklist.work.undo, exact: true }),
    ).toBeHidden();
    expect(await logs(request, item.id)).toHaveLength(0);
  });

  test("a stale engine counter must be confirmed, missing hours never submit", async ({
    page,
    request,
  }) => {
    const engine = randomUUID();
    await insert(request, "engines", {
      id: engine,
      boat_id: SEED.boat,
      label: "Moteur recette",
      position: "center",
    });
    await insert(request, "engine_hour_readings", {
      id: randomUUID(),
      boat_id: SEED.boat,
      engine_id: engine,
      hours: 410,
      read_at: "2020-01-01",
    });
    const item = await point(request, { engine_id: engine, interval_hours: 200 });
    await enter(page, request, item.label, "all");
    const line = page.locator(`[data-item-id="${item.id}"]`);
    await line.getByRole("checkbox").tap();
    const dialog = page.getByRole("dialog");
    const hours = dialog.getByRole("textbox", { name: "Heures Moteur recette", exact: true });
    await expect(hours).toHaveValue("");
    await dialog.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(dialog.getByText(fr.checklist.complete.hoursRequired)).toBeVisible();
    expect(await logs(request, item.id)).toHaveLength(0);
    await hours.fill("425");
    await dialog.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(dialog).toBeHidden();
    await expect(line.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(await logs(request, item.id)).toHaveLength(1);
  });

  test("missing history is not urgency and context survives reload", async ({ page, request }) => {
    const item = await point(request, { interval_months: null });
    await enter(page, request, item.label);
    await expect(page.locator(`[data-item-id="${item.id}"]`)).toHaveCount(0);
    await page
      .getByRole("button", { name: new RegExp(fr.checklist.work.filters.unrecorded) })
      .tap();
    await expect(page.locator(`[data-item-id="${item.id}"]`)).toBeVisible();
    await page
      .getByRole("combobox", { name: fr.checklist.board.category })
      .selectOption(categoryId);
    await page.reload();
    await expect(page.getByRole("combobox", { name: fr.checklist.board.category })).toHaveValue(
      categoryId,
    );
    await expect(page.getByRole("textbox", { name: fr.checklist.board.search })).toHaveValue(
      item.label,
    );
    await expect(page.locator(`[data-item-id="${item.id}"]`)).toBeVisible();
  });

  test("readers can inspect instructions but cannot complete a point", async ({
    page,
    request,
  }) => {
    const item = await point(request);
    await enter(page, request, item.label, "all", SEED.users.viewer);
    const line = page.locator(`[data-item-id="${item.id}"]`);
    await expect(line.getByRole("checkbox")).toBeDisabled();
    await line.getByRole("button", { name: new RegExp(item.label) }).tap();
    await expect(line.getByText("Ouvrir le capot", { exact: false })).toBeVisible();
    await expect(
      line.getByRole("button", { name: fr.checklist.work.doneToday, exact: true }),
    ).toHaveCount(0);
    expect(await logs(request, item.id)).toHaveLength(0);
  });
});

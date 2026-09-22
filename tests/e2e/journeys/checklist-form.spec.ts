import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { hasStack, SEED, skipReason, SUPABASE_URL, SERVICE_ROLE_KEY } from "../support/stack";

const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
const primary = "00000000-0000-0000-0000-00000000ca01";
const secondary = "00000000-0000-0000-0000-00000000ca02";
const evidence = {
  name: "Devis-fixation.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
};

async function addEvidence(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("region", { name: fr.attachments.title })
    .getByRole("button", { name: fr.attachments.files, exact: true })
    .tap();
  await (await chooser).setFiles(evidence);
}

test.describe("E4-14 shared categories and evidence", () => {
  test.skip(!hasStack, skipReason);

  test("creates one point in two systems with a document, then edits it", async ({
    page,
    request,
  }) => {
    const label = `Fixation à contrôler ${randomUUID().slice(0, 8)}`;
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist/new`);
    const docs = page.getByRole("region", { name: fr.attachments.title });
    await expect(docs).toBeVisible();
    await page.getByLabel(fr.checklist.form.label).fill(label);
    await page.getByRole("checkbox", { name: SEED.category, exact: true }).check();
    await page.getByRole("checkbox", { name: "Coque & Pont", exact: true }).check();
    await addEvidence(page);
    await expect(docs.getByLabel(fr.attachments.caption)).toBeVisible({ timeout: 15000 });
    await docs.getByLabel(fr.attachments.caption).fill("Devis avant remplacement");
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(page).toHaveURL(/checklist\?view=all&open=/, { timeout: 15000 });
    const id = new URL(page.url()).searchParams.get("open")!;
    const line = page.locator(`[data-item-id="${id}"]`);
    await expect(line.getByText("Devis avant remplacement")).toBeVisible();
    for (const system of [primary, secondary]) {
      await page.goto(
        `/boats/${SEED.boat}/checklist?view=all&system=${system}&q=${encodeURIComponent(label)}`,
      );
      await expect(page.locator(`[data-item-id="${id}"]`)).toHaveCount(1);
    }
    await page.goto(`/boats/${SEED.boat}/checklist/${primary}/${id}/edit`);
    await expect(page.getByRole("checkbox", { name: SEED.category, exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Coque & Pont", exact: true })).toBeChecked();
    await expect(page.getByText(evidence.name)).toBeVisible();
    await page.getByRole("checkbox", { name: SEED.category, exact: true }).uncheck();
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(page).toHaveURL(/checklist\?view=all&open=/);
    await page.reload();
    await expect(page.getByText("Devis avant remplacement")).toBeVisible();
    const response = await request.get(
      `${SUPABASE_URL}/rest/v1/checklist_item_status?id=eq.${id}&select=category_ids`,
      { headers },
    );
    expect(await response.json()).toEqual([{ category_ids: [secondary] }]);
  });

  test("keeps the form when an upload fails and allows removing the failed document", async ({
    page,
    request,
  }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist/new`);
    const label = `Photo en échec ${randomUUID().slice(0, 8)}`;
    await page.getByLabel(fr.checklist.form.label).fill(label);
    await page.getByRole("checkbox", { name: SEED.category, exact: true }).check();
    await page.route("**/storage/v1/object/boat-files/**", (route) => route.abort());
    const docs = page.getByRole("region", { name: fr.attachments.title });
    await addEvidence(page);
    await expect(docs.getByRole("alert")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: fr.common.save, exact: true })).toBeDisabled();
    await expect(page.getByLabel(fr.checklist.form.label)).toHaveValue(label);
    await page.unroute("**/storage/v1/object/boat-files/**");
    await docs.getByRole("button", { name: fr.common.retry, exact: true }).tap();
    await expect(docs.getByLabel(fr.attachments.caption)).toBeVisible({ timeout: 15000 });
    await docs.getByRole("button", { name: fr.common.delete, exact: true }).tap();
    await expect(page.getByRole("button", { name: fr.common.save, exact: true })).toBeEnabled();
    await expect(page.getByRole("checkbox", { name: SEED.category, exact: true })).toBeChecked();
  });

  test("retries a failed document commit without duplicating the point", async ({
    page,
    request,
  }) => {
    const label = `Pièce jointe à reprendre ${randomUUID().slice(0, 8)}`;
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist/new`);
    await page.getByLabel(fr.checklist.form.label).fill(label);
    await page.getByRole("checkbox", { name: SEED.category, exact: true }).check();
    const docs = page.getByRole("region", { name: fr.attachments.title });
    await addEvidence(page);
    await expect(docs.getByLabel(fr.attachments.caption)).toBeVisible({ timeout: 15000 });
    let actions = 0;
    await page.route(`**/boats/${SEED.boat}/checklist/new`, async (route) => {
      if (
        route.request().method() === "POST" &&
        route.request().headers()["next-action"] &&
        ++actions === 2
      ) {
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(page.getByText(fr.attachments.saveRetry)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(fr.checklist.form.label)).toHaveValue(label);
    await expect(docs.getByText(evidence.name)).toBeVisible();
    await page.unroute(`**/boats/${SEED.boat}/checklist/new`);
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(page).toHaveURL(/checklist\?view=all&open=/, { timeout: 15000 });
    const response = await request.get(
      `${SUPABASE_URL}/rest/v1/checklist_items?boat_id=eq.${SEED.boat}&label=eq.${encodeURIComponent(label)}&select=id`,
      { headers },
    );
    expect(await response.json()).toHaveLength(1);
    await expect(page.getByRole("link", { name: new RegExp(evidence.name) })).toBeVisible();
  });

  test("intervention uses the same document controls and saves its evidence", async ({
    page,
    request,
  }) => {
    const title = `Contrôle de fixation ${randomUUID().slice(0, 8)}`;
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/logs/new`);
    const docs = page.getByRole("region", { name: fr.attachments.title });
    await expect(docs).toBeVisible();
    const buttons = await Promise.all(
      [fr.attachments.camera, fr.attachments.library, fr.attachments.files].map(async (name) =>
        docs.getByRole("button", { name, exact: true }),
      ),
    );
    const boxes = await Promise.all(buttons.slice(0, 3).map((button) => button.boundingBox()));
    expect(new Set(boxes.map((box) => box?.height)).size).toBe(1);
    await page.getByLabel(fr.logs.form.title).fill(title);
    await page.getByRole("checkbox", { name: SEED.category, exact: true }).check();
    await page.getByRole("checkbox", { name: "Coque & Pont", exact: true }).check();
    await addEvidence(page);
    await expect(docs.getByLabel(fr.attachments.caption)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();
    await expect(page).toHaveURL(new RegExp(`/boats/${SEED.boat}/logs$`), { timeout: 15000 });
    const response = await request.get(
      `${SUPABASE_URL}/rest/v1/maintenance_logs_view?boat_id=eq.${SEED.boat}&title=eq.${encodeURIComponent(title)}&select=attachments_count,category_ids`,
      { headers },
    );
    const rows = await response.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].attachments_count).toBe(1);
    expect(rows[0].category_ids).toEqual(expect.arrayContaining([primary, secondary]));
  });
});

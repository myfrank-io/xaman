import { describe, expect, it } from "vitest";

import { parseHoursParam, firstParam } from "@/components/logs/log-form-values";
import { shortEngineLabel } from "@/components/logs/rows";
import { addDays, toIsoDate } from "@/lib/numbers";
import { saveLogSchema } from "@/lib/schemas/logs";

const BOAT = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const ENGINE = "33333333-3333-4333-8333-333333333333";
const LOG = "44444444-4444-4444-8444-444444444444";

function input(over: Record<string, unknown> = {}) {
  return {
    id: LOG,
    boatId: BOAT,
    title: "Vidange moteur SB",
    categoryId: CATEGORY,
    status: "done",
    performedAt: toIsoDate(),
    cost: "",
    contactId: null,
    equipmentId: null,
    haulOutId: null,
    notes: "",
    engineHours: [{ engineId: ENGINE, hours: "" }],
    checklistItemIds: [],
    ...over,
  };
}

describe("saveLogSchema", () => {
  it("keeps « empty » and « zero » apart: a blank cost stays unknown", () => {
    const parsed = saveLogSchema.parse(input({ cost: "" }));
    expect(parsed.cost).toBeNull();
    expect(saveLogSchema.parse(input({ cost: "0" })).cost).toBe(0);
  });

  it("reads numbers typed on a French keyboard", () => {
    expect(saveLogSchema.parse(input({ cost: "89,90" })).cost).toBe(89.9);
    expect(
      saveLogSchema.parse(input({ engineHours: [{ engineId: ENGINE, hours: "1 256,5" }] }))
        .engineHours,
    ).toEqual([{ engineId: ENGINE, hours: 1256.5 }]);
  });

  it("an empty hours field carries no reading (never a 0 h counter)", () => {
    expect(saveLogSchema.parse(input()).engineHours).toEqual([{ engineId: ENGINE, hours: null }]);
  });

  it("refuses a future date on work that is done, allows it on planned work (D17)", () => {
    const future = addDays(toIsoDate(), 5);
    const done = saveLogSchema.safeParse(input({ performedAt: future }));
    expect(done.success).toBe(false);
    expect(done.error?.issues[0]?.message).toBe("date_in_future_done");
    expect(
      saveLogSchema.safeParse(input({ performedAt: future, status: "in_progress" })).success,
    ).toBe(false);
    expect(saveLogSchema.safeParse(input({ performedAt: future, status: "planned" })).success).toBe(
      true,
    );
    expect(saveLogSchema.safeParse(input({ performedAt: future, status: "urgent" })).success).toBe(
      true,
    );
  });

  it("tolerates tomorrow, since the server runs in UTC and the boat does not", () => {
    expect(saveLogSchema.safeParse(input({ performedAt: addDays(toIsoDate(), 1) })).success).toBe(
      true,
    );
  });

  it("requires a title and a category (the column is nullable for the import only)", () => {
    expect(saveLogSchema.safeParse(input({ title: "   " })).success).toBe(false);
    expect(saveLogSchema.safeParse(input({ categoryId: "" })).success).toBe(false);
  });

  it("turns an emptied optional link back into null", () => {
    const parsed = saveLogSchema.parse(input({ contactId: "", equipmentId: "", notes: "  " }));
    expect(parsed.contactId).toBeNull();
    expect(parsed.equipmentId).toBeNull();
    expect(parsed.notes).toBeNull();
  });
});

describe("query-string prefill", () => {
  it("reads « ?hours=<engine>:<hours> », repeated or comma-separated", () => {
    expect(parseHoursParam(`${ENGINE}:1256`)).toEqual([{ engineId: ENGINE, hours: "1256" }]);
    expect(parseHoursParam([`${ENGINE}:1256`, `${BOAT}:1208`])).toHaveLength(2);
    expect(parseHoursParam(`${ENGINE}:1256,${BOAT}:1208`)).toHaveLength(2);
    expect(parseHoursParam(undefined)).toEqual([]);
    expect(parseHoursParam("garbage")).toEqual([]);
  });

  it("takes the first value of a repeated parameter", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("shortEngineLabel()", () => {
  it("keeps the distinguishing word for the dense list column", () => {
    expect(shortEngineLabel("Moteur SB")).toBe("SB");
    expect(shortEngineLabel("Annexe")).toBe("Annexe");
    expect(shortEngineLabel("  ")).toBe("  ");
  });
});

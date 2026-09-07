import { describe, expect, it } from "vitest";

import { isNavActive } from "@/components/layout/nav-active";
import { PRIMARY_NAV_KEYS, SECONDARY_NAV_KEYS } from "@/components/layout/nav";
import { boatPath } from "@/lib/queries/boat-routes";

const BOAT = "0406f409-ac58-4ec4-af7e-ef8e1261ec54";
const OTHER = "11111111-2222-4333-8444-555555555555";
const HAUL_OUT = "6e5f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8091";

const logs = boatPath(BOAT, "logs");
const haulOuts = boatPath(BOAT, "haulOuts");

/** The entries that are drawn as a bar: exactly one of them may be lit at a time. */
const MENU = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS].map((key) => boatPath(BOAT, key));
const lit = (pathname: string, entity?: string) =>
  MENU.filter((href) => isNavActive(pathname, href, entity));

describe("isNavActive", () => {
  it("lights the entry of the screen, and of every screen under it", () => {
    expect(lit(logs)).toEqual([logs]);
    expect(lit(`${logs}/new`)).toEqual([logs]);
    expect(lit(boatPath(BOAT, "checklist"))).toEqual([boatPath(BOAT, "checklist")]);
  });

  /**
   * « Sorties de l'eau » is the third tab of the Journal (D9): it left the menu but kept a path
   * of its own, and the bar used to go dark on it — the screen read as having left the section
   * it is reached from.
   */
  it("lights the Journal on the haul-outs, list and screens under it", () => {
    expect(lit(haulOuts)).toEqual([logs]);
    expect(lit(`${haulOuts}/new`)).toEqual([logs]);
    expect(lit(`${haulOuts}/${HAUL_OUT}`)).toEqual([logs]);
    expect(lit(`${haulOuts}/${HAUL_OUT}/edit`)).toEqual([logs]);
  });

  it("never lights one boat's Journal for another boat's haul-outs", () => {
    expect(isNavActive(boatPath(OTHER, "haulOuts"), logs)).toBe(false);
    expect(lit(boatPath(OTHER, "haulOuts"))).toEqual([]);
  });

  it("lights the list an import is going into, named by `?entity=`", () => {
    expect(lit(`/boats/${BOAT}/import`, "logs")).toEqual([logs]);
    expect(lit(`/boats/${BOAT}/import`, "parts")).toEqual([boatPath(BOAT, "boat")]);
    // A hand-typed URL with no entity: nothing to light rather than the wrong thing.
    expect(lit(`/boats/${BOAT}/import`)).toEqual([]);
  });

  it("lights nothing outside the boat tree", () => {
    expect(lit("/login")).toEqual([]);
    expect(lit("/boats/new")).toEqual([]);
  });
});

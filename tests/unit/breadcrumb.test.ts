import { describe, expect, it } from "vitest";

import { buildTrail } from "@/components/layout/breadcrumb-trail";

const BOAT = "0406f409-ac58-4ec4-af7e-ef8e1261ec54";
const LOG = "8c3ba2b4-9b91-46ac-91f7-3f6de5078bae";
const at = (path: string) => buildTrail(`/boats/${BOAT}${path}`, BOAT);

describe("buildTrail", () => {
  it("shows nothing on a tab root: the tab already says where you are", () => {
    expect(at("/logs")).toEqual([]);
    expect(at("/dashboard")).toEqual([]);
    expect(at("")).toEqual([]);
  });

  it("names the section and the step of a creation screen", () => {
    expect(at("/logs/new")).toEqual([
      { key: "logs", href: `/boats/${BOAT}/logs` },
      { key: "crumbs.new" },
    ]);
  });

  it("turns an id into « Fiche » and keeps the record reachable from its edit screen", () => {
    expect(at(`/logs/${LOG}/edit`)).toEqual([
      { key: "logs", href: `/boats/${BOAT}/logs` },
      { key: "crumbs.record", href: `/boats/${BOAT}/logs/${LOG}` },
      { key: "crumbs.edit" },
    ]);
  });

  it("follows the nested lists of the supplies screen", () => {
    expect(at("/supplies/parts/new")).toEqual([
      { key: "supplies", href: `/boats/${BOAT}/supplies` },
      { key: "crumbs.parts", href: `/boats/${BOAT}/supplies/parts` },
      { key: "crumbs.new" },
    ]);
  });

  it("covers the guided flows", () => {
    expect(at("/logs/review").at(-1)).toEqual({ key: "crumbs.review" });
    expect(at("/checklist/setup").at(-1)).toEqual({ key: "crumbs.setup" });
    expect(at("/import").at(-1)).toBeUndefined();
  });

  it("ignores a path that is not this boat's", () => {
    expect(buildTrail("/boats/other/logs/new", BOAT)).toEqual([]);
    expect(buildTrail("/login", BOAT)).toEqual([]);
  });
});

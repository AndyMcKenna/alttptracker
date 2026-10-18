import { describe, it, expect } from "vitest";
import { logic_regions } from "@/data/logic/logic_regions";
import { STATIC_DOOR_RULES, STATIC_LOCATION_RULES } from "@/data/logic/staticKeyLogic";

/**
 * The evaluator treats unknown simple tokens as available, so a generator rule that reaches the
 * tracker under its raw OWR name (e.g. can_dash_clip) silently opens everything behind it. OWR names
 * are snake_case; tracker tokens are camelCase.
 */
// Mapped on purpose to itself: the tracker treats it as always available
const ALLOWED = new Set(["has_blunt_weapon"]);

function collectTokens(node: unknown, out: Set<string>) {
  if (typeof node === "string") {
    out.add(node);
  } else if (Array.isArray(node)) {
    for (const child of node) collectTokens(child, out);
  } else if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      if (key === "to" || key === "type" || key === "region" || key === "dungeon" || key === "op" || key === "modes") continue;
      collectTokens(child, out);
    }
  }
}

describe("Logic vocabulary", () => {
  it("has no untranslated OWR rule names", () => {
    const tokens = new Set<string>();
    for (const region of Object.values(logic_regions)) {
      for (const spot of [...Object.values(region.exits ?? {}), ...Object.values(region.locations ?? {})]) {
        collectTokens(spot.requirements, tokens);
      }
    }
    collectTokens(STATIC_DOOR_RULES, tokens);
    collectTokens(STATIC_LOCATION_RULES, tokens);

    const untranslated = [...tokens]
      .map((token) => token.replace(/^(owg|hmg)\|/, ""))
      .filter((token) => /^[a-z]+_[a-z_]+/.test(token) && !ALLOWED.has(token));
    expect(untranslated).toEqual([]);
  });
});

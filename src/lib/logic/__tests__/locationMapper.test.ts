import { describe, it, expect } from "vitest";
import { getAllPossibleLocations } from "../locationMapper";

const namesOf = (entryKey: string) => getAllPossibleLocations(entryKey).map((l) => l.name);
const dungeonsOf = (entryKey: string) => new Set(namesOf(entryKey).filter((n) => n.includes(" - ")).map((n) => n.split(" - ")[0]));

/**
 * Locations belong to the dungeon/cave they are in without glitches. Glitch-only edges (HMG clips
 * between dungeons) and impassable ("never") edges must not pull other locations into an entry.
 */
describe("Location mapping", () => {
  it("keeps Thieves' Town checks separate from Desert Palace despite the HMG clip", () => {
    expect([...dungeonsOf("Thieves Town")]).toEqual(["Thieves' Town"]);
  });

  it("keeps Misery Mire checks separate from Tower of Hera and Swamp Palace", () => {
    expect([...dungeonsOf("Misery Mire")]).toEqual(["Misery Mire"]);
  });

  it("does not add Palace of Darkness to Spectacle Rock Cave through the Kiki skip", () => {
    expect(dungeonsOf("Spectacle Rock Cave (Bottom)").has("Palace of Darkness")).toBe(false);
  });

  it("does not follow impassable edges (Paradox Cave push block from the bottom)", () => {
    expect(namesOf("Paradox Cave (Bottom)")).not.toContain("Paradox Cave Lower - Far Left");
  });

  it("still maps every dungeon's own checks", () => {
    expect(namesOf("Desert Palace")).toContain("Desert Palace - Big Key Chest");
    expect(namesOf("Tower of Hera")).toContain("Tower of Hera - Big Key Chest");
    expect(namesOf("Swamp Palace")).toContain("Swamp Palace - Big Chest");
  });

  it("gives the Pyramid entrances no checks (Ganon is an event)", () => {
    expect(namesOf("Pyramid Entrance")).toEqual([]);
    expect(namesOf("Pyramid Hole")).toEqual([]);
  });
});

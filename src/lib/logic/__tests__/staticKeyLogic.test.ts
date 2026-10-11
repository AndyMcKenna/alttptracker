import { describe, it, expect } from "vitest";
import { getLogicSet } from "../logicMapper";
import { OverworldTraverser } from "../overworldTraverser";
import { buildEffectiveRegions } from "../regionsProvider";
import { applyStaticKeyLogic, computeTRReachability, isStaticKeyLogicActive, selectTRVariant } from "../staticKeyLogic";
import { gameState } from "./testHelpers";
import { logic_regions } from "@/data/logic/logic_regions";
import { formatLogicReasons } from "@/data/sequenceBreakLabels";
import type { GameState, RegionLogic } from "@/data/logic/logicTypes";

/**
 * Static key logic (OWR key_logic_algorithm: static): fixed per-door key thresholds counting chest
 * keys. Placement conditions ("big key in X", "small key at Y") only ever make things "possible".
 */
function calculate(builder: ReturnType<typeof gameState>) {
  const state = builder.build();
  const logicSet = getLogicSet("noglitches");
  const { regions, metadata } = buildEffectiveRegions(logicSet.regions as Record<string, RegionLogic>, state);
  const result = new OverworldTraverser(state, { ...logicSet, regions }, metadata).calculateAll();
  return { ...result, regions, trVariant: metadata.staticTRVariant };
}

/** All items, static key logic, wild small keys (so only collected keys count). */
function wildStatic() {
  return gameState().withAllItems().withSettings({ keyLogic: "static", wildSmallKeys: "wild" });
}

const hasToken = (value: unknown, token: string): boolean =>
  typeof value === "string" ? value === token : !!value && typeof value === "object" && Object.values(value).some((v) => hasToken(v, token));

describe("Static Key Logic", () => {
  describe("Overlay", () => {
    it("replaces every smallkey token when active", () => {
      const { regions } = calculate(wildStatic());
      expect(hasToken(regions, "smallkey")).toBe(false);
      expect(hasToken(logic_regions, "smallkey")).toBe(true);
    });

    it("does not mutate the base graph", () => {
      const before = JSON.stringify(logic_regions["PoD Arena Main"]);
      calculate(wildStatic());
      expect(JSON.stringify(logic_regions["PoD Arena Main"])).toBe(before);
    });

    it.each([
      ["non-vanilla doors", { doors: "crossed" as const }],
      ["shuffled key drops", { enemyDrop: "keys" as const }],
      ["shuffled pot keys", { pottery: "keys" as const }],
      ["universal keys", { wildSmallKeys: "universal" as const }],
    ])("is not applied with %s", (_label, settings) => {
      const state = wildStatic().withSettings(settings).build();
      expect(isStaticKeyLogicActive(state.settings)).toBe(false);
      const { regions, trVariant } = calculate(wildStatic().withSettings(settings));
      expect(trVariant).toBeUndefined();
      expect(hasToken(regions, "smallkey")).toBe(true);
    });
  });

  describe("Thresholds", () => {
    const arenaBridge = "Palace of Darkness - The Arena - Bridge";
    const darkMazeTop = "Palace of Darkness - Dark Maze - Top";
    const outOfLogic = ["staticKeysOutOfLogic"];

    it("opens PoD doors at their fixed key counts", () => {
      const at = (keys: number) => calculate(wildStatic().withDungeon("pod", { smallKeys: keys, bigKey: true }));
      expect(at(0).locationsLogic[arenaBridge]).toBe("available");
      expect(at(0).locationsLogic[darkMazeTop]).toBe("unavailable");
      // Below the static threshold the keys still technically open the door: out of logic
      expect(at(5).locationsLogic[darkMazeTop]).toBe("ool");
      expect(at(5).locationReasons[darkMazeTop]).toEqual(outOfLogic);
      expect(at(6).locationsLogic[darkMazeTop]).toBe("available");
      expect(at(6).locationsLogic["Palace of Darkness - Boss"]).toBe("available");
    });

    it("requires a chest key for the Desert Palace boss", () => {
      const at = (keys: number) => calculate(wildStatic().withDungeon("dp", { smallKeys: keys, bigKey: true }));
      // The vanilla pot keys open the doors, but static logic only counts chest keys
      expect(at(0).locationsLogic["Desert Palace - Boss"]).toBe("ool");
      expect(at(0).locationReasons["Desert Palace - Boss"]).toEqual(outOfLogic);
      expect(at(1).locationsLogic["Desert Palace - Boss"]).toBe("available");
    });

    it("requires a chest key for the HC Boomerang Chest outside standard only", () => {
      expect(calculate(wildStatic().withDungeon("hc", { smallKeys: 0 })).locationsLogic["Hyrule Castle - Boomerang Chest"]).toBe("ool");
      expect(calculate(wildStatic().withDungeon("hc", { smallKeys: 1 })).locationsLogic["Hyrule Castle - Boomerang Chest"]).toBe("available");
      const standard = calculate(wildStatic().withSettings({ worldState: "standard" }).withDungeon("hc", { smallKeys: 0 }));
      expect(standard.locationReasons["Hyrule Castle - Boomerang Chest"] ?? []).not.toContain("staticKeysOutOfLogic");
    });

    it("needs no keys in Eastern Palace", () => {
      const { locationsLogic } = calculate(wildStatic().withDungeon("ep", { smallKeys: 0, bigKey: true }));
      expect(locationsLogic["Eastern Palace - Boss"]).toBe("available");
    });

    it("opens Kholdstare's doors with Somaria and one key", () => {
      expect(calculate(wildStatic().withDungeon("ip", { smallKeys: 1, bigKey: true })).locationsLogic["Ice Palace - Boss"]).toBe("available");
      const noSomaria = calculate(wildStatic().withoutItems(["somaria"]).withDungeon("ip", { smallKeys: 1, bigKey: true }));
      expect(noSomaria.locationsLogic["Ice Palace - Boss"]).not.toBe("available");
      expect(calculate(wildStatic().withoutItems(["somaria"]).withDungeon("ip", { smallKeys: 2, bigKey: true })).locationsLogic["Ice Palace - Boss"]).toBe("available");
    });
  });

  describe("Placement assumptions", () => {
    it("marks Hera's Big Key Chest possible with no keys, with the reason", () => {
      const result = calculate(wildStatic().withDungeon("toh", { smallKeys: 0, bigKey: true }));
      expect(result.locationsLogic["Tower of Hera - Big Key Chest"]).toBe("possible");
      expect(result.locationReasons["Tower of Hera - Big Key Chest"]).toEqual(["assume|smallKey|toh|Tower of Hera - Big Key Chest"]);
      expect(calculate(wildStatic().withDungeon("toh", { smallKeys: 1, bigKey: true })).locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
    });

    it("never depends on checked locations", () => {
      const hera = (checks: string[]) =>
        calculate(wildStatic().withDungeon("toh", { smallKeys: 0, bigKey: true }).withChecks(checks)).locationsLogic["Tower of Hera - Big Key Chest"];
      expect(hera([])).toBe("possible");
      expect(hera(["Tower of Hera - Big Key Chest", "Tower of Hera - Basement Cage", "Tower of Hera - Map Chest"])).toBe("possible");
      const mire = (checks: string[]) =>
        calculate(wildStatic().withDungeon("mm", { smallKeys: 2, bigKey: true }).withChecks(checks)).locationsLogic["Misery Mire - Big Key Chest"];
      expect(mire(["Misery Mire - Compass Chest", "Misery Mire - Big Key Chest"])).toBe(mire([]));
    });

    it("formats reasons for the tooltip", () => {
      expect(formatLogicReasons("possible", ["assume|bigKey|ip|Ice Palace - Big Key Chest;Ice Palace - Map Chest;Ice Palace - Spike Room"])).toBe(
        "Possible if: the Big Key is in Big Key Chest, Map Chest or Spike Room",
      );
      expect(formatLogicReasons("possible", ["staticFindableKeys|pod|1", "staticFindableKeys|pod|6"])).toBe(
        "Possible if: the missing Small Keys are in unchecked locations (6 needed)",
      );
      expect(formatLogicReasons("ool", ["staticKeysOutOfLogic"])).toBe("Requires: Using keys outside static key logic");
      expect(formatLogicReasons("available", ["assume|smallKey|pod|x"])).toBeUndefined();
    });
  });

  describe("In-dungeon keys", () => {
    const keyFree = [
      "Palace of Darkness - Shooter Room",
      "Palace of Darkness - The Arena - Bridge",
      "Palace of Darkness - The Arena - Ledge",
      "Palace of Darkness - Map Chest",
      "Palace of Darkness - Stalfos Basement",
    ];

    it("marks locations behind unmet doors possible while keys may still be found", () => {
      const result = calculate(gameState().withAllItems().withSettings({ keyLogic: "static" }).withDungeon("pod", { smallKeys: 0 }));
      expect(result.locationsLogic["Palace of Darkness - The Arena - Bridge"]).toBe("available");
      expect(result.locationsLogic["Palace of Darkness - Dark Maze - Top"]).toBe("possible");
      expect(result.locationReasons["Palace of Darkness - Dark Maze - Top"]).toContain("staticFindableKeys|pod|6");
    });

    it("marks them unavailable once no unchecked reachable location can hold the missing keys", () => {
      const result = calculate(gameState().withAllItems().withSettings({ keyLogic: "static" }).withDungeon("pod", { smallKeys: 0 }).withChecks(keyFree));
      expect(result.locationsLogic["Palace of Darkness - Dark Maze - Top"]).toBe("unavailable");
    });

    it("does not assume keys with wild small keys", () => {
      const result = calculate(wildStatic().withDungeon("pod", { smallKeys: 3, bigKey: true }));
      expect(result.locationReasons["Palace of Darkness - Dark Maze - Top"]).toEqual(["staticKeysOutOfLogic"]);
    });
  });

  describe("Technical key access", () => {
    const basement = "Palace of Darkness - Dark Basement - Left";

    it("shows what the collected keys technically reach as out of logic", () => {
      for (const wildSmallKeys of ["wild", "inDungeon"] as const) {
        const result = calculate(gameState().withAllItems().withSettings({ keyLogic: "static", wildSmallKeys }).withDungeon("pod", { smallKeys: 2, bigKey: true }));
        expect(result.locationsLogic[basement]).toBe("ool");
        expect(result.locationReasons[basement]).toEqual(["staticKeysOutOfLogic"]);
      }
    });

    it("does not count keys that have not been collected", () => {
      expect(calculate(wildStatic().withDungeon("pod", { smallKeys: 0, bigKey: true })).locationsLogic[basement]).toBe("unavailable");
    });

    it("needs the big key to be marked for big key doors", () => {
      const boss = (bigKey: boolean) =>
        calculate(wildStatic().withSettings({ wildBigKeys: true }).withDungeon("pod", { smallKeys: 5, bigKey })).locationsLogic["Palace of Darkness - Boss"];
      expect(boss(true)).toBe("ool");
      expect(boss(false)).toBe("unavailable");
    });

    it("does not apply outside static key logic", () => {
      const result = calculate(gameState().withAllItems().withSettings({ wildSmallKeys: "wild" }).withDungeon("pod", { smallKeys: 2, bigKey: true }));
      expect(Object.values(result.locationReasons).flat()).not.toContain("staticKeysOutOfLogic");
    });
  });

  describe("Turtle Rock variants", () => {
    it("follows OWR's branch order", () => {
      expect(selectTRVariant({ back: true, front: true, middle: true, bigChest: true })).toBe("back");
      expect(selectTRVariant({ back: true, front: false, middle: false, bigChest: false })).toBe("back");
      expect(selectTRVariant({ back: false, front: true, middle: true, bigChest: false })).toBe("frontMiddle");
      expect(selectTRVariant({ back: false, front: true, middle: false, bigChest: true })).toBe("front");
      expect(selectTRVariant({ back: false, front: false, middle: true, bigChest: true })).toBe("bigChest");
      expect(selectTRVariant({ back: false, front: false, middle: true, bigChest: false })).toBe("none");
    });

    it("picks front in open (TR ledges are only reachable through the dungeon) and back in inverted", () => {
      expect(calculate(wildStatic()).trVariant).toBe("front");
      expect(calculate(wildStatic().withSettings({ worldState: "inverted" })).trVariant).toBe("back");
    });

    it("treats unplaced TR entrances as reachable under entrance shuffle", () => {
      const state: GameState = wildStatic().withSettings({ entranceMode: "crossed" }).build();
      const { regions } = buildEffectiveRegions(logic_regions as Record<string, RegionLogic>, state);
      expect(computeTRReachability(regions, state).back).toBe(true);
    });

    it("uses each variant's door numbers", () => {
      const state = wildStatic().build();
      const rule = (variant: Parameters<typeof applyStaticKeyLogic>[2], region: string, exit: string) =>
        JSON.stringify(applyStaticKeyLogic(logic_regions as Record<string, RegionLogic>, state, variant)[region].exits[exit].requirements.Open);
      expect(rule("front", "TR Hub", "TR Hub NW")).toContain("keys|tr|1");
      expect(rule("back", "TR Hub", "TR Hub NW")).toContain("keys|tr|4");
      expect(rule("back", "TR Crystaroller Top", "TR Crystaroller Down Stairs")).toContain("keys|tr|4");
      expect(rule("front", "TR Crystaroller Top", "TR Crystaroller Down Stairs")).toContain("keys|tr|3");
      expect(rule("bigChest", "TR Chain Chomps Bottom", "TR Chain Chomps SW")).toContain("assume|bigKey|tr|");
    });

    it("opens the front of Turtle Rock with one key in open mode", () => {
      const at = (keys: number) =>
        calculate(wildStatic().withDungeon("tr", { smallKeys: keys, bigKey: true })).locationsLogic["Turtle Rock - Chain Chomps"];
      expect(at(0)).toBe("unavailable");
      expect(at(1)).toBe("available");
    });
  });

  describe("Other key logic modes", () => {
    it("leaves partial and dangerous unchanged", () => {
      for (const keyLogic of ["partial", "dangerous"] as const) {
        const { trVariant, regions } = calculate(wildStatic().withSettings({ keyLogic }));
        expect(trVariant).toBeUndefined();
        expect(hasToken(regions, "smallkey")).toBe(true);
      }
    });
  });
});

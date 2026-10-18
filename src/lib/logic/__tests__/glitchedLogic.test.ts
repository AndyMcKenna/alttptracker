import { describe, it, expect } from "vitest";
import { getLogicSet, type LogicMode } from "../logicMapper";
import { OverworldTraverser } from "../overworldTraverser";
import { buildEffectiveRegions } from "../regionsProvider";
import { RequirementEvaluator } from "../requirementEvaluator";
import { gameState } from "./testHelpers";
import type { GameState, RegionLogic } from "@/data/logic/logicTypes";

/**
 * Overworld glitches (OWG) and hybrid major glitches (HMG) logic.
 * No-glitches tests live in the other test files.
 */
function calculate(builder: ReturnType<typeof gameState>, logicMode: LogicMode) {
  const state = builder.withSettings({ logicMode }).build();
  return new OverworldTraverser(state, getLogicSet(logicMode)).calculateAll();
}

/** Like calculate, but through the full graph pipeline (entrance links and mode-specific transforms), as the app runs it. */
function calculateEffective(builder: ReturnType<typeof gameState>, logicMode: LogicMode, tweak?: (state: GameState) => void) {
  const state = builder.withSettings({ logicMode }).build();
  tweak?.(state);
  const logicSet = getLogicSet(logicMode);
  const { regions, metadata } = buildEffectiveRegions(logicSet.regions as Record<string, RegionLogic>, state);
  return new OverworldTraverser(state, { ...logicSet, regions }, metadata).calculateAll();
}

const mireMedallion = (medallion: "bombos" | "ether" | "quake") => (state: GameState) => {
  state.entrances["Misery Mire"] = { ...state.entrances["Misery Mire"], medallion };
};

describe("Glitched logic", () => {
  // Rules that are unconditional (TRUE) in OWR's glitched worlds are tagged owg|true / hmg|true, so they
  // apply in their glitch mode only (the no-glitches side is tested in logicEngine.test.ts).
  describe("Unconditional glitch rules", () => {
    it("allows fake flippers in overworld glitches", () => {
      expect(calculate(gameState().withItems({ bomb: 1 }), "overworldglitches").locationsLogic["Hobo"]).toBe("available");
    });

    it("allows the Ice Lobby clip in hybrid glitches", () => {
      const builder = gameState()
        .withAllItems()
        .withSettings({ wildSmallKeys: "wild", pottery: "keys", enemyDrop: "keys", wildBigKeys: true })
        .withDungeon("ip", { smallKeys: 0 });

      expect(calculate(builder, "hybridglitches").locationsLogic["Ice Palace - Conveyor Key Drop"]).toBe("available");
    });
  });

  // A bunny (Dark World without the Moon Pearl) cannot dash or use items, so boots clips and
  // medallion pads need Link even in overworld glitches.
  describe("Overworld glitches without the Moon Pearl", () => {
    it("does not boots clip as a bunny", () => {
      const result = calculate(gameState().withItems({ boots: 1 }), "overworldglitches").locationsLogic;
      expect(result["Bumper Cave Ledge"]).toBe("unavailable");
      expect(result["Pyramid"]).toBe("unavailable");
      const withPearl = calculate(gameState().withItems({ boots: 1, moonpearl: 1 }), "overworldglitches").locationsLogic;
      expect(withPearl["Bumper Cave Ledge"]).toBe("available");
    });

    it("cannot open Misery Mire or enter Thieves' Town as a bunny", () => {
      const builder = gameState().withAllItems().withoutItems(["moonpearl"]).withDungeon("ct", { bossDefeated: true });
      const result = calculate(builder, "overworldglitches").locationsLogic;
      expect(result["Misery Mire - Main Lobby"]).toBe("unavailable");
      expect(result["Thieves' Town - Map Chest"]).toBe("unavailable");
      // Standing items stay collectable as a bunny
      expect(result["Pyramid"]).toBe("available");
    });

    it("needs no Moon Pearl for Dark World dungeons in inverted", () => {
      const builder = gameState().withSettings({ worldState: "inverted" }).withAllItems().withoutItems(["moonpearl"]);
      const result = calculate(builder, "overworldglitches").locationsLogic;
      expect(result["Misery Mire - Main Lobby"]).toBe("available");
      expect(result["Thieves' Town - Map Chest"]).toBe("available");
    });
  });

  // HMG clips connect dungeons (Mire → Hera, Thieves → Desert, ...), so one dungeon's traversal reaches
  // another dungeon's rooms. A room must keep the best result over all of them, not the last one computed.
  describe("Hybrid glitches clips between dungeons", () => {
    const midGame = { bomb: 1, lantern: 1, glove: 1, boots: 1, hookshot: 1, flute: 2 };
    // HMG places Hera's keys without logic; hold them so these tests only check how traversals merge
    const heraKeys = { smallKeys: 1, bigKey: true };

    it("keeps Tower of Hera reachable when Misery Mire's traversal also reaches it", () => {
      expect(calculate(gameState().withItems(midGame).withDungeon("toh", heraKeys), "hybridglitches").locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
    });

    it("never makes Tower of Hera worse by adding the Moon Pearl", () => {
      const withPearl = calculate(gameState().withItems({ ...midGame, moonpearl: 1 }).withDungeon("toh", heraKeys), "hybridglitches");
      expect(withPearl.locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
    });

    it("keeps Light World dungeons reachable when a bunny's Dark World dungeon clips into them", () => {
      // Without the Moon Pearl Thieves' Town and Misery Mire are only reached as a bunny; their clips into
      // Desert Palace and Tower of Hera must not override those dungeons' own results.
      const result = calculate(gameState().withAllItems().withoutItems(["moonpearl"]).withDungeon("toh", heraKeys), "hybridglitches").locationsLogic;
      for (const location of ["Desert Palace - Big Key Chest", "Desert Palace - Torch", "Desert Palace - Boss", "Tower of Hera - Big Key Chest", "Tower of Hera - Boss"]) {
        expect(result[location], location).toBe("available");
      }
    });
  });

  // OWR can_dash_clip / can_bomb_clip: Link (not a bunny) with boots, plus bombs for a bomb clip
  describe("Dungeon clip techniques", () => {
    const resolve = (items: Record<string, number>, token: string, linkState: "link" | "bunny" = "link") =>
      new RequirementEvaluator(gameState().withItems(items).withSettings({ logicMode: "hybridglitches" }).build()).evaluateWorldLogic(
        { Open: { always: { allOf: [token] } } },
        { linkState },
      );

    it("needs boots to dash clip and boots plus bombs to bomb clip", () => {
      expect(resolve({}, "canDashClip")).toBe("unavailable");
      expect(resolve({ boots: 1 }, "canDashClip")).toBe("available");
      expect(resolve({ boots: 1 }, "canBombClip")).toBe("unavailable");
      expect(resolve({ boots: 1, bomb: 1 }, "canBombClip")).toBe("available");
    });

    it("cannot clip as a bunny", () => {
      expect(resolve({ boots: 1, bomb: 1 }, "canDashClip", "bunny")).toBe("unavailable");
      expect(resolve({ boots: 1, bomb: 1 }, "canBombClip", "bunny")).toBe("unavailable");
    });

    it("needs bombs for the Kiki Skip into Palace of Darkness", () => {
      expect(calculateEffective(gameState().withItems({ boots: 1 }), "hybridglitches").locationsLogic["Palace of Darkness - Shooter Room"]).toBe("unavailable");
      expect(calculateEffective(gameState().withItems({ boots: 1, bomb: 1 }), "hybridglitches").locationsLogic["Palace of Darkness - Shooter Room"]).toBe("available");
    });
  });

  // OWR dungeon_reentry_rules: after clipping into a dungeon, its door only lets you out if you could have
  // come in through it, unless the clip links straight to the exterior (crossed, lean, lite, insanity)
  describe("Leaving a clipped-into dungeon", () => {
    const kikiSkip = () =>
      gameState()
        .withItems({ boots: 1, bomb: 1 })
        .withEntranceLink("Palace of Darkness", "Palace of Darkness")
        .withEntranceLink("Spectacle Rock Cave (Bottom)", "Spectacle Rock Cave (Bottom)")
        .withEntranceLink("Spectacle Rock Cave", "Spectacle Rock Cave")
        .withEntranceLink("Spectacle Rock Cave Peak", "Spectacle Rock Cave Peak");

    it("does not walk out of Palace of Darkness to the Pyramid after the Kiki Skip (vanilla entrances)", () => {
      expect(calculateEffective(gameState().withItems({ boots: 1, bomb: 1 }), "hybridglitches").locationsLogic["Pyramid"]).toBe("unavailable");
    });

    it("does not walk out after the Kiki Skip when dungeons only shuffle among themselves", () => {
      expect(calculateEffective(kikiSkip().withSettings({ entranceMode: "simple" }), "hybridglitches").locationsLogic["Pyramid"]).toBe("unavailable");
    });

    it("walks out after the Kiki Skip in crossed entrance shuffle", () => {
      expect(calculateEffective(kikiSkip().withSettings({ entranceMode: "crossed" }), "hybridglitches").locationsLogic["Pyramid"]).toBe("available");
    });
  });

  // OWR UnderworldGlitchRules: through the Mire clip into Swamp, the moat is crossed without draining the dam
  // (Old Man S&Q + Hera's or GT's door leading to Hera or Mire) and Trench 1 drains without the hammer
  describe("Misery Mire to Swamp Palace", () => {
    const mireRoute = { boots: 1, moonpearl: 1, flippers: 1, flute: 1, ether: 1, sword: 2, lantern: 1, firerod: 1, hookshot: 1, somaria: 1, bomb: 1, glove: 1 };

    it("reaches Swamp Palace through the Mire clip without the mirror or hammer", () => {
      // (Swamp's small key is held: HMG places it without logic)
      const result = calculateEffective(gameState().withItems(mireRoute).withDungeon("sp", { smallKeys: 1 }), "hybridglitches", mireMedallion("ether")).locationsLogic;
      expect(result["Swamp Palace - Entrance"]).toBe("available");
      expect(result["Swamp Palace - Big Chest"]).toBe("available");
    });

    it("needs flippers and the clip", () => {
      expect(calculateEffective(gameState().withItems({ ...mireRoute, flippers: 0 }), "hybridglitches", mireMedallion("ether")).locationsLogic["Swamp Palace - Entrance"]).toBe("unavailable");
      expect(calculateEffective(gameState().withItems({ ...mireRoute, boots: 0 }), "hybridglitches", mireMedallion("ether")).locationsLogic["Swamp Palace - Entrance"]).toBe("unavailable");
    });

    it("only applies with dungeon-only or no entrance shuffle, and only in hybrid glitches", () => {
      expect(calculateEffective(gameState().withItems(mireRoute).withSettings({ entranceMode: "crossed" }), "hybridglitches", mireMedallion("ether")).locationsLogic["Swamp Palace - Entrance"]).toBe("unavailable");
      expect(calculateEffective(gameState().withItems(mireRoute), "overworldglitches", mireMedallion("ether")).locationsLogic["Swamp Palace - Entrance"]).toBe("unavailable");
    });
  });

  // Turtle Rock's front half holds keys OWR may place assuming the front door; entering from the ledges they
  // are behind small key doors, so only Chain Chomps is guaranteed
  describe("Turtle Rock from the Dark Death Mountain ledges", () => {
    it.each(["overworldglitches", "hybridglitches"] as const)("keeps the key-locked rooms possible in %s", (mode) => {
      const result = calculateEffective(gameState().withItems({ somaria: 1, moonpearl: 1, boots: 1 }), mode).locationsLogic;
      expect(result["Turtle Rock - Chain Chomps"]).toBe("available");
      expect(result["Turtle Rock - Compass Chest"]).toBe("possible");
      expect(result["Turtle Rock - Big Key Chest"]).toBe("possible");
    });
  });

  // Not in OWR's logic (commented out there) but added by the extractor for the glitched modes
  describe("Glitches beyond OWR", () => {
    it("waterwalks to Zora's Ledge and the Waterfall Fairy with boots", () => {
      for (const mode of ["overworldglitches", "hybridglitches"] as const) {
        const result = calculateEffective(gameState().withItems({ boots: 1, moonpearl: 1 }), mode).locationsLogic;
        expect(result["Zora's Ledge"], mode).toBe("available");
        expect(result["Waterfall Fairy - Left"], mode).toBe("available");
      }
      const noGlitches = calculateEffective(gameState().withItems({ boots: 1, moonpearl: 1 }), "noglitches").locationsLogic;
      expect(noGlitches["Zora's Ledge"]).toBe("unavailable");
    });

    it("does not waterwalk as a bunny", () => {
      const result = calculateEffective(gameState().withItems({ boots: 1 }).withSettings({ worldState: "inverted" }), "overworldglitches").locationsLogic;
      expect(result["Zora's Ledge"]).toBe("unavailable");
      expect(result["Waterfall Fairy - Left"]).toBe("unavailable");
    });

    it("reaches Hookshot Cave without gloves through the Dark World Floating Island", () => {
      const items = { boots: 1, moonpearl: 1, hookshot: 1, bomb: 1 };
      expect(calculateEffective(gameState().withItems(items), "overworldglitches").locationsLogic["Hookshot Cave - Top Right"]).toBe("available");
      expect(calculateEffective(gameState().withItems(items), "noglitches").locationsLogic["Hookshot Cave - Top Right"]).toBe("unavailable");
    });

    it("enters Ganon's Tower through the Screen Wrap Clip without the crystals", () => {
      const builder = () => gameState().withItems({ boots: 1, moonpearl: 1 }).withSettings({ gtOpen: "7" });
      expect(calculateEffective(builder(), "overworldglitches").locationsLogic["Ganons Tower - Bob's Torch"]).toBe("available");
      expect(calculateEffective(builder(), "noglitches").locationsLogic["Ganons Tower - Bob's Torch"]).toBe("unavailable");
    });
  });

  // Dropping down Superbunny Cave's hole as a bunny and climbing back up gives superbunny state (OWR, in logic
  // for the glitched modes)
  describe("Superbunny Cave drop", () => {
    it.each(["overworldglitches", "hybridglitches"] as const)("opens the Superbunny Cave chests without the Moon Pearl in %s", (mode) => {
      const result = calculateEffective(gameState().withItems({ flute: 2, glove: 2, hookshot: 1 }), mode).locationsLogic;
      expect(result["Superbunny Cave - Top"]).toBe("available");
      expect(result["Superbunny Cave - Bottom"]).toBe("available");
      // Superbunny state does not survive leaving the cave
      expect(result["Hookshot Cave - Top Right"]).toBe("unavailable");
    });

    it("reaches the cave without gloves by clipping onto the Turtle Rock teleporter ledge", () => {
      expect(calculateEffective(gameState().withItems({ boots: 1, hammer: 1 }), "overworldglitches").locationsLogic["Superbunny Cave - Top"]).toBe("available");
    });
  });

  // Hybrid glitches places Hera's big key without logic (OWR Fill.py), so it may be behind its own door
  describe("Tower of Hera big key in hybrid glitches", () => {
    const heraItems = { flute: 2, glove: 1, lantern: 1, mirror: 1, sword: 2, firerod: 1, hookshot: 1, hammer: 1, boots: 1 };
    const mireRoute = { ...heraItems, moonpearl: 1, ether: 1, somaria: 1, bomb: 1, flippers: 1 };
    const upstairs = ["Tower of Hera - Compass Chest", "Tower of Hera - Big Chest", "Tower of Hera - Boss"];

    it("keeps upstairs possible without the big key", () => {
      const result = calculateEffective(gameState().withItems(heraItems).withDungeon("toh", { smallKeys: 1 }), "hybridglitches");
      for (const location of upstairs) expect(result.locationsLogic[location], location).toBe("possible");
      expect(result.locationReasons["Tower of Hera - Compass Chest"]).toContain("hmgBigKeyUnplaced|toh");
      expect(result.locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
      // No glitches is unaffected
      expect(calculateEffective(gameState().withItems(heraItems), "noglitches").locationsLogic["Tower of Hera - Compass Chest"]).toBe("available");
    });

    it("opens upstairs once the big key is found", () => {
      const result = calculateEffective(gameState().withItems(heraItems).withDungeon("toh", { bigKey: true }), "hybridglitches").locationsLogic;
      for (const location of upstairs) expect(result[location], location).toBe("available");
    });

    it("opens upstairs with Mire's big key through the Mire clip", () => {
      const result = calculateEffective(gameState().withItems(mireRoute), "hybridglitches", mireMedallion("ether")).locationsLogic;
      for (const location of upstairs) expect(result[location], location).toBe("available");
    });

    it("uses a found Mire big key for Hera's and Swamp's big chests when big keys are wild", () => {
      const builder = () => gameState().withItems(mireRoute).withSettings({ wildBigKeys: true }).withDungeon("sp", { smallKeys: 1 });
      const without = calculateEffective(builder(), "hybridglitches", mireMedallion("ether")).locationsLogic;
      expect(without["Tower of Hera - Big Chest"]).toBe("unavailable");
      const withMireKey = calculateEffective(builder().withDungeon("mm", { bigKey: true }), "hybridglitches", mireMedallion("ether")).locationsLogic;
      expect(withMireKey["Tower of Hera - Big Chest"]).toBe("available");
      expect(withMireKey["Swamp Palace - Big Chest"]).toBe("available");
    });
  });

  // Hybrid glitches also places Hera's and Swamp's small keys without logic (OWR Fill.py)
  describe("Tower of Hera and Swamp Palace small keys in hybrid glitches", () => {
    const items = { flute: 2, glove: 2, lantern: 1, mirror: 1, sword: 2, firerod: 1, hookshot: 1, hammer: 1, boots: 1, moonpearl: 1, flippers: 1, bomb: 1 };

    it("keeps rooms behind their own small key doors possible until the keys are collected", () => {
      const result = calculateEffective(gameState().withItems(items), "hybridglitches");
      expect(result.locationsLogic["Tower of Hera - Basement Cage"]).toBe("available");
      expect(result.locationsLogic["Tower of Hera - Big Key Chest"]).toBe("possible");
      expect(result.locationsLogic["Swamp Palace - Entrance"]).toBe("available");
      expect(result.locationsLogic["Swamp Palace - Map Chest"]).toBe("possible");
      expect(result.locationReasons["Swamp Palace - Map Chest"]).toContain("hmgSmallKeyUnplaced|sp");
      expect(calculateEffective(gameState().withItems(items), "noglitches").locationsLogic["Swamp Palace - Map Chest"]).toBe("available");
    });

    it("opens them once every small key of the dungeon is collected", () => {
      const result = calculateEffective(gameState().withItems(items).withDungeon("toh", { smallKeys: 1 }).withDungeon("sp", { smallKeys: 1 }), "hybridglitches").locationsLogic;
      expect(result["Tower of Hera - Big Key Chest"]).toBe("available");
      expect(result["Swamp Palace - Map Chest"]).toBe("available");
      // With pot keys shuffled Swamp has 6 keys, so one is not enough
      const pots = calculateEffective(gameState().withItems(items).withSettings({ pottery: "keys" }).withDungeon("sp", { smallKeys: 1 }), "hybridglitches").locationsLogic;
      expect(pots["Swamp Palace - Map Chest"]).toBe("possible");
    });

    it("opens Swamp's doors with 6 Mire small keys through the Mire clip", () => {
      const result = calculateEffective(gameState().withAllItems().withDungeon("mm", { smallKeys: 6 }), "hybridglitches", mireMedallion("ether")).locationsLogic;
      expect(result["Swamp Palace - Map Chest"]).toBe("available");
      expect(calculateEffective(gameState().withAllItems(), "hybridglitches", mireMedallion("ether")).locationsLogic["Swamp Palace - Map Chest"]).toBe("possible");
    });
  });
});

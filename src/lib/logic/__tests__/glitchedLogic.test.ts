import { describe, it, expect } from "vitest";
import { getLogicSet, type LogicMode } from "../logicMapper";
import { OverworldTraverser } from "../overworldTraverser";
import { gameState } from "./testHelpers";

/**
 * Overworld glitches (OWG) and hybrid major glitches (HMG) logic.
 * No-glitches tests live in the other test files.
 */
function calculate(builder: ReturnType<typeof gameState>, logicMode: LogicMode) {
  const state = builder.withSettings({ logicMode }).build();
  return new OverworldTraverser(state, getLogicSet(logicMode)).calculateAll();
}

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

    it("keeps Tower of Hera reachable when Misery Mire's traversal also reaches it", () => {
      expect(calculate(gameState().withItems(midGame), "hybridglitches").locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
    });

    it("never makes Tower of Hera worse by adding the Moon Pearl", () => {
      const withPearl = calculate(gameState().withItems({ ...midGame, moonpearl: 1 }), "hybridglitches");
      expect(withPearl.locationsLogic["Tower of Hera - Big Key Chest"]).toBe("available");
    });

    it("keeps Light World dungeons reachable when a bunny's Dark World dungeon clips into them", () => {
      // Without the Moon Pearl Thieves' Town and Misery Mire are only reached as a bunny; their clips into
      // Desert Palace and Tower of Hera must not override those dungeons' own results.
      const result = calculate(gameState().withAllItems().withoutItems(["moonpearl"]), "hybridglitches").locationsLogic;
      for (const location of ["Desert Palace - Big Key Chest", "Desert Palace - Torch", "Desert Palace - Boss", "Tower of Hera - Big Key Chest", "Tower of Hera - Boss"]) {
        expect(result[location], location).toBe("available");
      }
    });
  });
});

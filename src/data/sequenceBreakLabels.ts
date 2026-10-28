import { DungeonsData } from "@/data/dungeonData";

/**
 * Human-readable labels for sequence break keys.
 * Used to display ool reasons in tooltips.
 */
export const SEQUENCE_BREAK_LABELS: Record<string, string> = {
  canNavigateDarkRooms: "Dark Room Navigation",
  canIceBreak: "Ice Breaker",
  canBombJump: "Bomb Jumps",
  canHover: "Hover",
  canHoverAlot: "Long Hovers",
  canSpeckyClip: "Specky Clip",
  canFireSpooky: "Spooky Action (Fire)",
  canBombSpooky: "Spooky Action (Bomb)",
  canHeraPot: "Herapot",
  canMimicClip: "Mimic Clip",
  canPotionCameraUnlock: "Potion Camera Unlock",
  canMoldormBounce: "Moldorm Bounce",
  canTorchRoomNavigateBlind: "Lightless Torch Room Navigation",
  canBombOrBonkCameraUnlock: "Bonk/Bomb Camera Unlock",
  canTombRaider: "Tomb Raider",
  canFakePowder: "Fake Powder",
  canQirnJump: "Qirn Jump",
  canFairyReviveHover: "Fairy Revive Hover",
  canFakeFlipper: "Fake Flippers",
  canOWFairyRevive: "OW Fairy Revival",
  canMirrorSuperBunny: "Mirror Super Bunny",
  canSuperBunny: "Mirror Super Bunny",
  canSuperBunnyCave: "Superbunny Cave Drop",
  canDungeonBunnyRevive: "Dungeon Bunny Revive",
  canWaterWalk: "Water Walk",
  canZoraSplashDelete: "Zora Splash Delete",
  canBunnyPocket: "Bunny Pocket",
  canFairyBarrierRevive: "Fairy Barrier Revive",
  canShockBlock: "Shock Block",
  canBunnyCitrus: "Bunny Citrus",
  canTamSwam: "TAM Swam",
  canMirrorWrap: "Mirror Wrap",
  canHookClip: "Hook Clip",
  canDarkRoomNavigateBlind: "Dark Room Navigation (Blind)",
  canReachHCMain: "Dropdown Access or Mirror for HC Main",
  staticKeysOutOfLogic: "Using keys outside static key logic",
};

export function getSequenceBreakLabel(key: string): string {
  return SEQUENCE_BREAK_LABELS[key] ?? key;
}

/** "Palace of Darkness - Big Key Chest" → "Big Key Chest" */
function shortLocationName(name: string): string {
  const idx = name.indexOf(" - ");
  return idx >= 0 ? name.slice(idx + 3) : name;
}

function listOf(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** Label for a static key logic reason (see requirementEvaluator "keys" / "assume"), or undefined. */
function staticKeyReasonLabel(key: string): string | undefined {
  const [kind, type, , locations] = key.split("|");
  if (kind === "assume") {
    const where = listOf(locations.split(";").map(shortLocationName));
    return type === "bigKey" ? `the Big Key is in ${where}` : `a Small Key is in ${where}`;
  }
  if (kind === "staticFindableKeys") {
    return `the missing Small Keys are in unchecked locations (${key.split("|")[2]} needed)`;
  }
  // Hybrid Major Glitches places Hera's and Swamp's keys without logic: hmgBigKeyUnplaced|<dungeonId>
  if (kind === "hmgBigKeyUnplaced" || kind === "hmgSmallKeyUnplaced") {
    const dungeon = DungeonsData[type]?.name ?? type;
    return kind === "hmgBigKeyUnplaced"
      ? `${dungeon}'s Big Key isn't behind its own door (Hybrid Major Glitches places it without logic)`
      : `${dungeon}'s Small Keys aren't behind their own doors (Hybrid Major Glitches places them without logic)`;
  }
  return undefined;
}

/**
 * Tooltip text explaining an "ool" (sequence breaks) or "possible" (static key assumptions) status,
 * or undefined when there is nothing to explain.
 */
export function formatLogicReasons(status: string, reasons: string[] | undefined): string | undefined {
  if (!reasons?.length || (status !== "ool" && status !== "possible")) return undefined;
  // Keep only the highest findable-keys requirement per dungeon
  const findable = new Map<string, string>();
  const others: string[] = [];
  for (const key of reasons) {
    if (key.startsWith("staticFindableKeys|")) {
      const [, dungeon, count] = key.split("|");
      const current = findable.get(dungeon);
      if (!current || parseInt(current.split("|")[2]) < parseInt(count)) findable.set(dungeon, key);
    } else {
      others.push(key);
    }
  }
  const labels = [...others, ...findable.values()].map((key) => staticKeyReasonLabel(key) ?? getSequenceBreakLabel(key));
  return `${status === "ool" ? "Requires" : "Possible if"}: ${[...new Set(labels)].join("; ")}`;
}

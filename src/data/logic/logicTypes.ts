import type { DungeonsState } from "@/store/dungeonsSlice";
import type { EntrancesState } from "@/store/entrancesSlice";
import type { ItemsState } from "@/store/itemsSlice";
import type { OverworldState } from "@/store/overworldSlice";
import type { SettingsState } from "@/store/settingsSlice";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type LogicRequirement = string | { allOf?: LogicRequirement[] } | { anyOf?: LogicRequirement[] } | {};

export type LogicStatus = "unavailable" | "possible" | "ool" |  "available" | "information";

export type CrystalSwitchState = "blue" | "orange" | "unknown";

/**
 * Tri-state of the player's form in a given region.
 * - "link": full Link (moonpearl in DW, or LW). All actions available.
 * - "superbunny": bunny who has entered a non-overworld area; can open chests,
 *   swing sword, dash, bonk, use sword beams, bunny-pocket, and die-to-revive in dungeons.
 * - "bunny": cannot perform any actions; can only walk/pick up some items.
 *
 * Ordering for "best path wins": link > superbunny > bunny.
 */
export type LinkState = "link" | "bunny" | "superbunny";

export interface LogicState {
  always?: LogicRequirement;
  logical?: LogicRequirement;
  required?: LogicRequirement;
  information?: LogicRequirement;
  scout?: LogicRequirement;
}

export interface WorldLogic {
  Open?: LogicState | LogicRequirement;
  Inverted?: LogicState | LogicRequirement;
  Inverted_1?: LogicState | LogicRequirement;
  Standard?: LogicState | LogicRequirement;
  Entrance?: string[];
}

export interface ExitLogic {
  [exitName: string]: {
      to: string;
      type: string;
      requirements: WorldLogic;
    }
}

export interface RegionLogic {
  type: string
  locations: { [locationName: string]: {
    requirements: WorldLogic;
    type?: string;
  } }
  entrances: string[]
  exits: ExitLogic
  owid?: number | null;
  tileid?: number;
}


export interface RegionReachability {
  status: LogicStatus;
  linkState: LinkState;
  crystalStates?: Set<CrystalSwitchState>;
  /** Sequence-break reason keys that caused this region to have "ool" status. */
  oolReasons?: string[];
}

export interface DungeonTraversalResult {
  regionStatuses: Map<string, LogicStatus>; // Internal region statuses
  exitStatuses: Map<string, LogicStatus>; // Dungeon -> Overworld exits
  bigKeyGatedRegions?: Set<string>; // Regions only reachable through a bigkey exit
  smallKeyGatedRegions?: Set<string>; // Regions only reachable through a smallkey exit
}

export interface GameState {
  items: ItemsState;
  settings: SettingsState;
  dungeons: DungeonsState;
  entrances: EntrancesState;
  overworld: OverworldState;
  checks?: Record<string, { checked: boolean }>;
}


/**
 * OWR "static" key logic overlay (generated into staticKeyLogic.ts). Turtle Rock rules depend on
 * which TR entrances are reachable with all items, so those entries carry one rule per variant.
 */
export type StaticTRVariant = "back" | "frontMiddle" | "front" | "bigChest" | "none";
export type StaticRule = LogicRequirement | { tr: Record<StaticTRVariant, LogicRequirement> };

export interface StaticDoorRule {
  region: string;
  dungeon: string;
  rule: StaticRule;
}

export interface StaticLocationRule {
  region: string;
  dungeon: string;
  op: "and" | "replace";
  modes?: ("standard" | "nonstandard")[];
  rule: StaticRule;
}

export interface StaticKeyCandidates {
  /** Locations that may hold this dungeon's small key */
  all: string[];
  /** Of those, the ones that may not hold it outside standard mode */
  nonStandardExclude: string[];
}

export interface StaticTRProbe {
  back: string;
  front: string;
  middle: string;
  bigChest: string;
  keyDoorExits: string[];
}

export type LogicData = Record<string, LogicState>;
export type WorldLogicData = Record<string, WorldLogic>;
export type DungeonLogicData = Record<string, LogicData>;


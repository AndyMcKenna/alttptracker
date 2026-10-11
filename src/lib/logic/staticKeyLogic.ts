import type {
  ExitLogic,
  GameState,
  LogicRequirement,
  LogicState,
  RegionLogic,
  StaticRule,
  StaticTRVariant,
  WorldLogic,
} from "@/data/logic/logicTypes";
import type { SettingsState } from "@/store/settingsSlice";
import type { DungeonsState } from "@/store/dungeonsSlice";
import { STATIC_DOOR_RULES, STATIC_KEY_CANDIDATES, STATIC_LOCATION_RULES, STATIC_TR_PROBE } from "@/data/logic/staticKeyLogic";
import { DungeonsData } from "@/data/dungeonData";
import { createAllItemsState } from "./logicHelpers";
import { RequirementEvaluator } from "./requirementEvaluator";

/**
 * OWR "static" key logic (key_logic_algorithm: static).
 *
 * Static key logic is a pure threshold model: a key door opens once the dungeon's collected chest keys
 * reach a fixed number, and keys are never spent. It is applied as an overlay on the region graph:
 * each key door's "smallkey" token is replaced by its threshold requirement (keys|<id>|N, with
 * assume|... alternatives) and a few location rules are ANDed on. With no "smallkey" left, the
 * DungeonTraverser's key spending/contention phases have nothing to do.
 *
 * The tracker never knows where items are: OWR's placement conditions ("big key in X", "small key
 * at Y") stay assume|... tokens, which only ever make something "possible" (with a reason).
 */

const WORLD_KEYS = ["Open", "Inverted", "Inverted_1", "Standard"] as const;
const TIERS = ["always", "logical", "required"] as const;

/** Static key logic only exists for vanilla doors with unshuffled key drops and pot keys. */
export function isStaticKeyLogicSupported(settings: SettingsState): boolean {
  return (
    settings.doors === "vanilla" &&
    settings.enemyDrop === "none" &&
    (settings.pottery === "none" || settings.pottery === "cave") &&
    settings.wildSmallKeys !== "universal"
  );
}

export function isStaticKeyLogicActive(settings: SettingsState): boolean {
  return settings.keyLogic === "static" && isStaticKeyLogicSupported(settings);
}

function isStandardMode(settings: SettingsState): boolean {
  return settings.worldState === "standard";
}

export function resolveStaticRule(rule: StaticRule, trVariant: StaticTRVariant): LogicRequirement {
  if (typeof rule === "object" && rule !== null && "tr" in rule) return rule.tr[trVariant];
  return rule;
}

/**
 * OWR picks the Turtle Rock rules by which TR entrances are reachable with all items but no TR keys,
 * in this order (StaticKeyLogic.set_turtle_rock_rules).
 */
export function selectTRVariant(flags: { back: boolean; front: boolean; middle: boolean; bigChest: boolean }): StaticTRVariant {
  if (flags.back) return "back";
  if (flags.front && flags.middle) return "frontMiddle";
  if (flags.front) return "front";
  if (flags.bigChest) return "bigChest";
  return "none";
}

function fullCompletionDungeons(state: GameState): DungeonsState {
  const dungeons: DungeonsState = { ...state.dungeons };
  for (const [id, data] of Object.entries(DungeonsData)) {
    dungeons[id] = {
      ...state.dungeons[id],
      bossDefeated: true,
      prizeCollected: true,
      bigKey: true,
      smallKeys: data.totalLocations?.smallkeys ?? 0,
    } as DungeonsState[string];
  }
  return dungeons;
}

/**
 * Which TR probe regions are reachable with all items and no Turtle Rock small keys. A boolean
 * fixpoint over every exit (overworld and dungeon) that structurally skips TR key doors. Under
 * entrance shuffle a TR portal whose entrance is not placed yet counts as reachable, which biases
 * towards the strictest variant ("back") until the layout is known.
 */
export function computeTRReachability(regions: Record<string, RegionLogic>, state: GameState) {
  const allState: GameState = { ...createAllItemsState(state), dungeons: fullCompletionDungeons(state) };
  const evaluator = new RequirementEvaluator(allState, regions, { assumeAllStaticKeys: true });
  const skipped = new Set(STATIC_TR_PROBE.keyDoorExits);
  const crystals = new Set(["blue", "orange"] as const);
  const visited = new Set<string>(["Menu", "Flute Sky"].filter((r) => regions[r]));

  const canPass = (exit: ExitLogic[string], from: string) =>
    evaluator.evaluateWorldLogic(exit.requirements, {
      regionName: from,
      crystalStates: crystals,
      assumeSmallKey: true,
      assumeBigKey: true,
      canReachRegion: (name) => (visited.has(name) ? "available" : "unavailable"),
      canReachFromRegion: (_source, target) => (visited.has(target) ? "available" : "unavailable"),
    }) !== "unavailable";

  // canReach|X requirements can open up once X is visited, so iterate to a fixpoint
  let changed = true;
  while (changed) {
    changed = false;
    for (const from of [...visited]) {
      for (const [exitName, exit] of Object.entries(regions[from]?.exits ?? {})) {
        if (!exit?.to || visited.has(exit.to) || skipped.has(exitName)) continue;
        if (canPass(exit, from)) {
          visited.add(exit.to);
          changed = true;
        }
      }
    }
  }

  const unplaced = (probe: string): boolean => {
    if (state.settings.entranceMode === "none") return false;
    const portals = Object.entries(regions)
      .filter(([name, region]) => !name.startsWith("TR ") && Object.values(region.exits ?? {}).some((e) => e?.to === probe))
      .map(([name]) => name);
    return portals.some(
      (portal) =>
        !Object.entries(regions).some(
          ([name, region]) => name !== portal && !name.startsWith("TR ") && Object.values(region.exits ?? {}).some((e) => e?.to === portal),
        ),
    );
  };

  const reachable = (probe: string) => visited.has(probe) || unplaced(probe);
  return {
    back: reachable(STATIC_TR_PROBE.back),
    front: reachable(STATIC_TR_PROBE.front),
    middle: reachable(STATIC_TR_PROBE.middle),
    bigChest: reachable(STATIC_TR_PROBE.bigChest),
  };
}

function containsToken(req: LogicRequirement, token: string): boolean {
  if (typeof req === "string") return req === token;
  if ("allOf" in req && req.allOf) return req.allOf.some((r) => containsToken(r, token));
  if ("anyOf" in req && req.anyOf) return req.anyOf.some((r) => containsToken(r, token));
  return false;
}

/** Replace every occurrence of a token; a null replacement removes it (i.e. makes it always true). */
function replaceToken(req: LogicRequirement, token: string, replacement: LogicRequirement | null): LogicRequirement {
  if (typeof req === "string") return req === token ? (replacement ?? {}) : req;
  if ("allOf" in req && req.allOf) {
    const parts = req.allOf
      .map((r) => replaceToken(r, token, replacement))
      .filter((r) => typeof r === "string" || Object.keys(r).length > 0);
    return parts.length === 0 ? {} : { allOf: parts };
  }
  if ("anyOf" in req && req.anyOf) return { anyOf: req.anyOf.map((r) => replaceToken(r, token, replacement)) };
  return req;
}

function andRequirement(req: LogicRequirement | undefined, extra: LogicRequirement): LogicRequirement {
  if (req === undefined || (typeof req === "object" && Object.keys(req).length === 0)) return extra;
  return { allOf: [req, extra] };
}

/** Map over each world's LogicState, normalising a bare requirement into { always }. */
function mapWorldLogic(worldLogic: WorldLogic, fn: (state: LogicState | "never") => LogicState | "never"): WorldLogic {
  const result: WorldLogic = { ...worldLogic };
  for (const key of WORLD_KEYS) {
    const value = worldLogic[key];
    if (value === undefined) continue;
    let state: LogicState | "never";
    if (value === "never") state = "never";
    else if (typeof value === "string" || "allOf" in value || "anyOf" in value) state = { always: value as LogicRequirement };
    else state = value as LogicState;
    result[key] = fn(state) as WorldLogic[typeof key];
  }
  return result;
}

function replaceTokenInWorld(worldLogic: WorldLogic, token: string, replacement: LogicRequirement | null): WorldLogic {
  return mapWorldLogic(worldLogic, (state) => {
    if (state === "never") return state;
    const out: LogicState = { ...state };
    for (const tier of TIERS) {
      if (out[tier] !== undefined) out[tier] = replaceToken(out[tier]!, token, replacement);
    }
    return out;
  });
}

function andIntoWorld(worldLogic: WorldLogic, extra: LogicRequirement): WorldLogic {
  return mapWorldLogic(worldLogic, (state) => {
    if (state === "never") return state;
    // Add to the hard gate when there is one; adding a new "always" next to logical/required tiers
    // would turn "unavailable" into "possible".
    if (state.always !== undefined || (state.logical === undefined && state.required === undefined)) {
      return { ...state, always: andRequirement(state.always, extra) };
    }
    const out: LogicState = { ...state };
    if (out.logical !== undefined) out.logical = andRequirement(out.logical, extra);
    if (out.required !== undefined) out.required = andRequirement(out.required, extra);
    return out;
  });
}

function replaceWorld(worldLogic: WorldLogic, rule: LogicRequirement): WorldLogic {
  return mapWorldLogic(worldLogic, (state) => (state === "never" ? state : { always: rule }));
}

/**
 * Apply the static key logic overlay to a region graph (copy-on-write; the input is never mutated).
 */
export function applyStaticKeyLogic(regions: Record<string, RegionLogic>, state: GameState, trVariant: StaticTRVariant): Record<string, RegionLogic> {
  const result: Record<string, RegionLogic> = { ...regions };
  const copiedExits = new Set<string>();
  const copiedLocations = new Set<string>();

  const exitsOf = (regionName: string): ExitLogic => {
    if (!copiedExits.has(regionName)) {
      result[regionName] = { ...result[regionName], exits: { ...result[regionName].exits } };
      copiedExits.add(regionName);
    }
    return result[regionName].exits;
  };
  const locationsOf = (regionName: string): RegionLogic["locations"] => {
    if (!copiedLocations.has(regionName)) {
      result[regionName] = { ...result[regionName], locations: { ...result[regionName].locations } };
      copiedLocations.add(regionName);
    }
    return result[regionName].locations;
  };

  for (const [exitName, door] of Object.entries(STATIC_DOOR_RULES)) {
    const exit = regions[door.region]?.exits?.[exitName];
    if (!exit) continue;
    const rule = resolveStaticRule(door.rule, trVariant);
    const requirements = containsWorldToken(exit.requirements, "smallkey")
      ? replaceTokenInWorld(exit.requirements, "smallkey", rule)
      : andIntoWorld(exit.requirements, rule);
    exitsOf(door.region)[exitName] = { ...exit, requirements };
  }

  // Any remaining "smallkey" marks a door side OWR does not treat as a key door (e.g. the far side of
  // a one-way key door), so it needs no key under static logic.
  for (const [regionName, region] of Object.entries(result)) {
    for (const [exitName, exit] of Object.entries(region.exits ?? {})) {
      if (exit && containsWorldToken(exit.requirements, "smallkey")) {
        exitsOf(regionName)[exitName] = { ...exit, requirements: replaceTokenInWorld(exit.requirements, "smallkey", null) };
      }
    }
  }

  const mode = isStandardMode(state.settings) ? "standard" : "nonstandard";
  for (const [locationName, entry] of Object.entries(STATIC_LOCATION_RULES)) {
    if (entry.modes && !entry.modes.includes(mode)) continue;
    const location = regions[entry.region]?.locations?.[locationName];
    if (!location) continue;
    const rule = resolveStaticRule(entry.rule, trVariant);
    const requirements = entry.op === "replace" ? replaceWorld(location.requirements, rule) : andIntoWorld(location.requirements, rule);
    locationsOf(entry.region)[locationName] = { ...location, requirements };
  }

  return result;
}

function containsWorldToken(worldLogic: WorldLogic, token: string): boolean {
  return WORLD_KEYS.some((key) => {
    const value = worldLogic[key];
    if (value === undefined || value === "never") return false;
    if (typeof value === "string" || "allOf" in value || "anyOf" in value) return containsToken(value as LogicRequirement, token);
    return TIERS.some((tier) => (value as LogicState)[tier] !== undefined && containsToken((value as LogicState)[tier]!, token));
  });
}

/** Locations that may hold this dungeon's small key under static key logic. */
export function staticKeyCandidates(dungeonId: string, settings: SettingsState): string[] {
  const candidates = STATIC_KEY_CANDIDATES[dungeonId];
  if (!candidates) return [];
  if (isStandardMode(settings)) return candidates.all;
  const excluded = new Set(candidates.nonStandardExclude);
  return candidates.all.filter((name) => !excluded.has(name));
}

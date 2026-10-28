import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import MapLocation from "../MapLocation";
import { createTestStore, renderWithStore } from "./renderWithStore";
import { updateDungeonState } from "@/store/dungeonsSlice";
import { setSettings } from "@/store/settingsSlice";
import { setEntranceLink } from "@/store/entrancesSlice";
import type { LogicStatus } from "@/data/logic/logicTypes";

// Mock the hook that MapLocation depends on
const mockToggleAllChecks = vi.fn();
const mockResetGroups = vi.fn();
const mockHandleCheckClick = vi.fn();
const mockHandleGroupExpand = vi.fn();

let mockHookReturn = {
  itemLocations: ["Test Location - Chest"],
  itemChecks: {
    "Test Location - Chest": {
      displayName: "Chest",
      status: { checked: false, logic: "unavailable" as LogicStatus, manuallyChecked: false, scoutedItems: [] },
    },
  },
  displayList: [],
  status: "none" as "all" | "some" | "none",
  maxLogicStatus: "unavailable" as LogicStatus,
  handleCheckClick: mockHandleCheckClick,
  handleGroupExpand: mockHandleGroupExpand,
  toggleAllChecks: mockToggleAllChecks,
  resetGroups: mockResetGroups,
  targetName: "Test Location",
};

vi.mock("@/hooks/useLocationTooltipData", () => ({
  useLocationTooltipData: () => mockHookReturn,
}));

const defaultLocation = { x: 100, y: 200, world: "lw" as const, open: true, isDungeon: false, overworld: true, shopsanity: false, pots: false, enemies: false, bonk: false };

describe("MapLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default unchecked/unavailable state
    mockHookReturn = {
      itemLocations: ["Test Location - Chest"],
      itemChecks: {
        "Test Location - Chest": {
          displayName: "Chest",
          status: { checked: false, logic: "unavailable", manuallyChecked: false, scoutedItems: [] },
        },
      },
      displayList: [],
      status: "none",
      maxLogicStatus: "unavailable",
      handleCheckClick: mockHandleCheckClick,
      handleGroupExpand: mockHandleGroupExpand,
      toggleAllChecks: mockToggleAllChecks,
      resetGroups: mockResetGroups,
      targetName: "Test Location",
    };
  });

  it("should use the unavailable background class when the location is unavailable", () => {
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute.inset-0") as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain("bg-status-unavailable");
  });

  it("should use the available background class when the location is available", () => {
    mockHookReturn.maxLogicStatus = "available";
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute.inset-0") as HTMLElement;
    expect(el.className).toContain("bg-status-available");
  });

  it("should use the possible background class when the location is possible", () => {
    mockHookReturn.maxLogicStatus = "possible";
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute.inset-0") as HTMLElement;
    expect(el.className).toContain("bg-status-possible");
  });

  it("should use the checked background class when all items are checked", () => {
    mockHookReturn.status = "all";
    mockHookReturn.itemChecks["Test Location - Chest"].status.checked = true;
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute.inset-0") as HTMLElement;
    expect(el.className).toContain("bg-status-checked");
  });

  it("should apply hatched class when some items are checked", () => {
    mockHookReturn.status = "some";
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute.inset-0") as HTMLElement;
    expect(el.className).toContain("is-hatched");
  });

  it("should call toggleAllChecks when clicked", async () => {
    const user = userEvent.setup();
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute") as HTMLElement;
    await user.click(el);
    expect(mockToggleAllChecks).toHaveBeenCalledTimes(1);
  });

  it("should be positioned based on location coordinates", () => {
    renderWithStore(
      <MapLocation name="Test Location" location={defaultLocation} type="item" isEntrance={false} />,
    );
    const el = document.querySelector(".absolute") as HTMLElement;
    const xPercent = (100 / 512) * 100;
    const yPercent = (200 / 512) * 100;
    expect(el.style.left).toBe(`${xPercent}%`);
    expect(el.style.top).toBe(`${yPercent}%`);
  });

  describe("prize icon in the boss square", () => {
    const epLocation = { ...defaultLocation, overworld: false, isDungeon: true };
    const renderEP = (prize: string) => {
      mockHookReturn.itemLocations = ["Eastern Palace - Boss"];
      mockHookReturn.itemChecks = {
        "Eastern Palace - Boss": {
          displayName: "Boss",
          status: { checked: false, logic: "available", manuallyChecked: false, scoutedItems: [] },
        },
      } as unknown as typeof mockHookReturn.itemChecks;
      const store = createTestStore();
      store.dispatch(updateDungeonState({ dungeon: "ep", newState: { prize: prize as never } }));
      renderWithStore(<MapLocation name="Eastern Palace" location={epLocation} type="item" isEntrance={false} />, { store });
      return Array.from(document.querySelectorAll<HTMLElement>("[style]")).map((el) => el.style.backgroundImage);
    };

    it("shows the prize once it is known", () => {
      expect(renderEP("greenPendant").some((bg) => bg.includes("/dungeons/green_pendant.png"))).toBe(true);
    });

    it("shows the map icon when only the map is known", () => {
      expect(renderEP("map").some((bg) => bg.includes("/dungeons/map.png"))).toBe(true);
    });

    it("shows nothing for an unknown prize", () => {
      expect(renderEP("unknown").some((bg) => bg.includes("/dungeons/"))).toBe(false);
    });
  });

  describe("old style dungeon squares", () => {
    const renderLinkedToEP = (useOldStyleDungeonSquares: boolean) => {
      mockHookReturn.itemLocations = ["Eastern Palace - Boss"];
      mockHookReturn.itemChecks = {
        "Eastern Palace - Boss": {
          displayName: "Boss",
          status: { checked: false, logic: "available", manuallyChecked: false, scoutedItems: [] },
        },
      } as unknown as typeof mockHookReturn.itemChecks;
      mockHookReturn.maxLogicStatus = "available";
      const store = createTestStore();
      store.dispatch(setSettings({ entranceMode: "crossed", useOldStyleDungeonSquares }));
      store.dispatch(setEntranceLink({ entrance: "Links House", to: "Eastern Palace", entranceMode: "crossed" }));
      store.dispatch(updateDungeonState({ dungeon: "ep", newState: { prize: "greenPendant" } }));
      renderWithStore(<MapLocation name="Links House" location={defaultLocation} type="entrance" isEntrance />, { store });
      return document.querySelector(".absolute.inset-0") as HTMLElement;
    };

    it("draws a plain square in the dungeon label colour with a black outline", () => {
      const square = renderLinkedToEP(true);
      expect(square.style.backgroundColor).toBe("rgb(50, 205, 50)");
      expect(square.className).toContain("border-black");
      expect(square.className).not.toContain("bg-status-available");
      // No boss square or prize icon
      expect(document.querySelector(".inset-1")).toBeNull();
      expect(document.querySelectorAll("[style*='/dungeons/']").length).toBe(0);
    });

    it("keeps logic colouring, boss square and prize when disabled", () => {
      const square = renderLinkedToEP(false);
      expect(square.className).toContain("bg-status-available");
      expect(document.querySelector(".inset-1")).toBeTruthy();
    });
  });
});

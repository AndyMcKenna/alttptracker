import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import MysteryModal from "../MysteryModal";
import { createTestStore, renderWithStore } from "./renderWithStore";
import { setSettings } from "@/store/settingsSlice";

/** The in-tracker settings modal must represent all three small key modes, not just wild/in-dungeon. */
describe("MysteryModal small keys", () => {
  it("shows universal small keys and keeps them on submit", () => {
    const store = createTestStore();
    store.dispatch(setSettings({ wildSmallKeys: "universal" }));
    renderWithStore(<MysteryModal />, { store });

    expect((screen.getByDisplayValue("Universal") as HTMLSelectElement).value).toBe("universal");
    fireEvent.click(screen.getByText("Submit"));
    expect(store.getState().settings.wildSmallKeys).toBe("universal");
  });

  it("can switch small keys to universal", () => {
    const store = createTestStore();
    renderWithStore(<MysteryModal />, { store });

    fireEvent.change(screen.getByDisplayValue("In Dungeon"), { target: { value: "universal" } });
    fireEvent.click(screen.getByText("Submit"));
    expect(store.getState().settings.wildSmallKeys).toBe("universal");
  });
});

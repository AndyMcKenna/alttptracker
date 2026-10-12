import { describe, it, expect } from "vitest";
import { fireEvent } from "@testing-library/react";
import MapLocation from "../MapLocation";
import { createTestStore, renderWithStore } from "./renderWithStore";
import { setSettings } from "@/store/settingsSlice";
import { entranceLocations } from "@/data/locationsData";

/** Middle click A then left click B links A to B; middle click A then middle click B makes a connector. */
describe("Entrance click flows", () => {
  const setup = () => {
    const store = createTestStore();
    store.dispatch(setSettings({ entranceMode: "crossed" }));
    const { container } = renderWithStore(
      <>
        <MapLocation name="Links House" location={entranceLocations["Links House"]} type="entrance" isEntrance />
        <MapLocation name="Dam" location={entranceLocations["Dam"]} type="entrance" isEntrance />
      </>,
      { store },
    );
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>(".group"));
    const middle = (el: HTMLElement) => fireEvent(el, new MouseEvent("auxclick", { button: 1, bubbles: true }));
    return { store, a, b, middle };
  };

  it("middle click then left click links the first entrance to the second", () => {
    const { store, a, b, middle } = setup();
    middle(a);
    fireEvent.click(b, { button: 0 });
    expect(store.getState().entrances["Links House"].to).toBe("Dam");
    expect(store.getState().trackerState.currentMode).toBe("none");
  });

  it("middle click on two entrances makes a generic connector", () => {
    const { store, a, b, middle } = setup();
    middle(a);
    middle(b);
    expect(store.getState().entrances["Links House"].to).toMatch(/^Generic Connector/);
    expect(store.getState().entrances["Dam"].to).toBe(store.getState().entrances["Links House"].to);
  });

  it("middle clicking the same entrance twice clears it and cancels", () => {
    const { store, a, b, middle } = setup();
    middle(a);
    middle(b);
    middle(a);
    middle(a);
    expect(store.getState().entrances["Links House"].to).toBeNull();
    expect(store.getState().entrances["Dam"].to).toBeNull();
    expect(store.getState().trackerState.currentMode).toBe("none");
  });
});

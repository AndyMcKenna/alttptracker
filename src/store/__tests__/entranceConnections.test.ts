import { describe, it, expect } from "vitest";
import { createTestStore } from "@/components/tracker/__tests__/renderWithStore";
import { connectGenericConnector, setEntranceLink } from "@/store/entrancesSlice";
import { setCurrentMode, setSelectedEntrance } from "@/store/trackerSlice";

describe("Entrance connections", () => {
  it("clearing one side of a generic connector clears the orphaned other side", () => {
    const store = createTestStore();
    store.dispatch(connectGenericConnector({ source: "Links House", destination: "Dam", connectorId: 1 }));
    store.dispatch(setEntranceLink({ entrance: "Links House", to: null, entranceMode: "crossed" }));
    const { entrances } = store.getState();
    expect(entrances["Links House"]).toMatchObject({ to: null, checked: false, connectorGroup: null });
    expect(entrances["Dam"]).toMatchObject({ to: null, checked: false, connectorGroup: null });
  });

  it("keeps a connector with more than two sides when one side leaves", () => {
    const store = createTestStore();
    store.dispatch(connectGenericConnector({ source: "Links House", destination: "Dam", connectorId: 1 }));
    store.dispatch(connectGenericConnector({ source: "Links House", destination: "Sanctuary", connectorId: 2 }));
    store.dispatch(setEntranceLink({ entrance: "Links House", to: null, entranceMode: "crossed" }));
    const { entrances } = store.getState();
    expect(entrances["Dam"]).toMatchObject({ to: "Generic Connector 1", connectorGroup: 1 });
    expect(entrances["Sanctuary"]).toMatchObject({ to: "Generic Connector 1", connectorGroup: 1 });
  });

  it.each([
    ["clearing the selection", [null, false] as [string | null, boolean]],
    ["opening an entrance's menu", ["Dam", true] as [string | null, boolean]],
  ])("ends a pending connection when %s", (_label, payload) => {
    const store = createTestStore();
    store.dispatch(setSelectedEntrance(["Links House", false]));
    store.dispatch(setCurrentMode("generic_connect"));
    store.dispatch(setSelectedEntrance(payload));
    expect(store.getState().trackerState.currentMode).toBe("none");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
import LogicProvider from "@/components/LogicProvider";
import { OverworldTraverser } from "@/lib/logic/overworldTraverser";
import { renderWithStore } from "@/components/tracker/__tests__/renderWithStore";
import { setItemCount } from "@/store/itemsSlice";
import { setLocationChecked } from "@/store/checksSlice";

/**
 * The logic writes its results back into the checks slice. LogicProvider must only react to the
 * checked flags there, or every change would run the (expensive) logic twice.
 */
describe("LogicProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = () => {
    const runs = vi.spyOn(OverworldTraverser.prototype, "calculateAll");
    const { store } = renderWithStore(
      <LogicProvider>
        <div />
      </LogicProvider>,
    );
    runs.mockClear();
    return { store, runs };
  };

  it("runs the logic once per item change", () => {
    const { store, runs } = setup();
    act(() => {
      store.dispatch(setItemCount({ itemName: "glove", count: 1 }));
    });
    expect(runs).toHaveBeenCalledTimes(1);
  });

  it("re-runs when a location is checked", () => {
    const { store, runs } = setup();
    act(() => {
      store.dispatch(setLocationChecked({ location: "Link's House", checked: true }));
    });
    expect(runs).toHaveBeenCalledTimes(1);
  });

  it("does not run when a state update changes nothing (e.g. a repeated autotracker poll)", () => {
    const { store, runs } = setup();
    act(() => {
      store.dispatch(setItemCount({ itemName: "glove", count: 1 }));
    });
    runs.mockClear();
    act(() => {
      store.dispatch(setItemCount({ itemName: "glove", count: 1 }));
    });
    expect(runs).not.toHaveBeenCalled();
  });
});

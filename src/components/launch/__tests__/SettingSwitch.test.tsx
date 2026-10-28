import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingSwitch } from "../SettingControls";

describe("SettingSwitch", () => {
  it("shows a help icon only when a description is given", () => {
    const { rerender } = render(<SettingSwitch label="Plain" checked={false} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("About Plain")).toBeNull();
    rerender(<SettingSwitch label="Explained" checked={false} onChange={vi.fn()} description="Longer explanation" />);
    expect(screen.getByLabelText("About Explained")).toBeTruthy();
  });
});

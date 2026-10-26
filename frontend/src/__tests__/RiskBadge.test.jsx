import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RiskBadge from "../components/RiskBadge";

describe("RiskBadge", () => {
  it.each([
    ["At-Risk", "bg-red-100"],
    ["On-Track", "bg-green-100"],
    ["Excelling", "bg-blue-100"],
  ])("renders %s with its colour", (level, bg) => {
    render(<RiskBadge level={level} />);
    expect(screen.getByText(level)).toHaveClass(bg);
  });

  it("falls back to On-Track styling for an unknown level", () => {
    render(<RiskBadge level="Unknown" />);
    expect(screen.getByText("Unknown")).toHaveClass("bg-green-100");
  });
});

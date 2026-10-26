import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiStatusBanner from "../components/AiStatusBanner";
import api from "../services/api";

vi.mock("../services/api", () => ({ default: { get: vi.fn() } }));

describe("AiStatusBanner", () => {
  it("warns when the LLM circuit is open", async () => {
    api.get.mockResolvedValue({ data: { llm: { configured: true, available: false } } });
    render(<AiStatusBanner />);
    expect(await screen.findByRole("status")).toHaveTextContent("AI temporarily unavailable");
  });

  it("stays hidden when the LLM is available", async () => {
    api.get.mockResolvedValue({ data: { llm: { configured: true, available: true } } });
    const { container } = render(<AiStatusBanner />);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

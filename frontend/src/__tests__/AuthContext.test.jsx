import { useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import api from "../services/api";

vi.mock("../services/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

let ctx;
const capture = value => { ctx = value; };

function Probe() {
  const auth = useAuth();
  useEffect(() => { capture(auth); });
  return <p>{auth.loading ? "loading" : auth.user ? `user:${auth.user.role}` : "anonymous"}</p>;
}

describe("AuthContext", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is anonymous without a stored token", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("logs in, stores the token and checks student consent", async () => {
    api.post.mockResolvedValue({ data: { access_token: "tok" } });
    api.get.mockImplementation(url => Promise.resolve(
      url === "/auth/me" ? { data: { role: "student" } } : { data: { accepted: false } }
    ));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("anonymous");

    await act(() => ctx.login("s@test.com", "pw"));
    expect(localStorage.getItem("access_token")).toBe("tok");
    expect(screen.getByText("user:student")).toBeInTheDocument();
    expect(ctx.consentStatus).toBe(false);

    act(() => ctx.logout());
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(screen.getByText("anonymous")).toBeInTheDocument();
  });

  it("drops an invalid stored token", async () => {
    localStorage.setItem("access_token", "expired");
    api.get.mockRejectedValue(new Error("401"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});

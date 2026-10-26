import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));

function renderAt(path, allowedRoles) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/unauthorized" element={<p>unauthorized page</p>} />
        <Route path="/consent" element={<p>consent page</p>} />
        <Route path="*" element={<ProtectedRoute allowedRoles={allowedRoles}><p>secret page</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("sends anonymous users to login", () => {
    auth.value = { user: null, loading: false, consentStatus: null };
    renderAt("/instructor", ["instructor"]);
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("shows 403 page for the wrong role", () => {
    auth.value = { user: { role: "student" }, loading: false, consentStatus: true };
    renderAt("/instructor", ["instructor"]);
    expect(screen.getByText("unauthorized page")).toBeInTheDocument();
  });

  it("sends students without privacy consent to the consent page", () => {
    auth.value = { user: { role: "student" }, loading: false, consentStatus: false };
    renderAt("/student", ["student"]);
    expect(screen.getByText("consent page")).toBeInTheDocument();
  });

  it("renders the page for an allowed, consenting user", () => {
    auth.value = { user: { role: "student" }, loading: false, consentStatus: true };
    renderAt("/student", ["student"]);
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });
});

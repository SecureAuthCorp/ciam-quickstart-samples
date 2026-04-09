import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const mockUseAuth = vi.fn();

vi.mock("react-oidc-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useAuth: () => mockUseAuth(),
}));

import App from "./App";

test("renders sign in button when not authenticated", () => {
  mockUseAuth.mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    error: null,
    signinRedirect: vi.fn(),
  });
  render(<App />);
  expect(screen.getByRole("heading")).toHaveTextContent(
    "SecureAuth React PKCE Demo",
  );
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
});

test("renders loading state", () => {
  mockUseAuth.mockReturnValue({
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });
  render(<App />);
  expect(screen.getByText("Loading...")).toBeDefined();
});

test("renders error state", () => {
  mockUseAuth.mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    error: { message: "Something went wrong" },
  });
  render(<App />);
  expect(screen.getByText("Error: Something went wrong")).toBeDefined();
});

test("renders welcome message when authenticated", () => {
  mockUseAuth.mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    error: null,
    user: { profile: { name: "Test User" } },
    removeUser: vi.fn(),
  });
  render(<App />);
  expect(screen.getByText("Welcome, Test User")).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
});

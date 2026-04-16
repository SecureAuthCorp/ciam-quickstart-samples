import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
const mockSigninSilent = vi.fn();

vi.mock("react-oidc-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useAuth: () => mockUseAuth(),
}));

import App from "./App";

describe("App (Token Refresh)", () => {
  afterEach(() => cleanup());
  it("renders sign in button when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    render(<App />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows token info and refresh button when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signinSilent: mockSigninSilent,
      user: {
        profile: { given_name: "Jane" },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    render(<App />);
    expect(screen.getByText("Welcome, Jane")).toBeInTheDocument();
    expect(screen.getByText("Refresh token now")).toBeInTheDocument();
  });

  it("renders error message when authentication fails", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: new Error("Unable to refresh token"),
    });
    render(<App />);
    expect(screen.getByText(/Unable to refresh token/)).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("calls signinSilent when refresh button is clicked", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signinSilent: mockSigninSilent,
      user: {
        profile: { given_name: "Jane" },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    });
    render(<App />);
    fireEvent.click(screen.getByText("Refresh token now"));
    expect(mockSigninSilent).toHaveBeenCalled();
  });
});

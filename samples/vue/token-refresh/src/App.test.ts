import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const isLoading = ref(false);
const isAuthenticated = ref(false);
const user = ref<any>(null);
const error = ref<Error | null>(null);
const expiresAt = ref("unknown");
const signinRedirect = vi.fn();
const signoutRedirect = vi.fn();
const refresh = vi.fn();

vi.mock("./auth", () => ({
  useAuth: () => ({
    isLoading,
    isAuthenticated,
    user,
    error,
    expiresAt,
    signinRedirect,
    signoutRedirect,
    refresh,
  }),
}));

import App from "./App.vue";

describe("App (Token Refresh)", () => {
  beforeEach(() => {
    isLoading.value = false;
    isAuthenticated.value = false;
    user.value = null;
    error.value = null;
    expiresAt.value = "unknown";
    signinRedirect.mockReset();
    signoutRedirect.mockReset();
    refresh.mockReset();
  });

  afterEach(() => cleanup());

  it("renders sign in button when not authenticated", () => {
    render(App);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows token info and refresh button when authenticated", () => {
    isAuthenticated.value = true;
    user.value = { profile: { given_name: "Jane" } };
    expiresAt.value = "10:30:00 AM";
    render(App);
    expect(screen.getByText("Welcome, Jane")).toBeInTheDocument();
    expect(
      screen.getByText("Token expires at: 10:30:00 AM"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh token now" }),
    ).toBeInTheDocument();
  });

  it("renders error message when authentication fails", () => {
    error.value = new Error("Unable to refresh token");
    render(App);
    expect(screen.getByText(/Unable to refresh token/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("calls refresh when refresh button is clicked", async () => {
    isAuthenticated.value = true;
    user.value = { profile: { given_name: "Jane" } };
    expiresAt.value = "10:30:00 AM";
    render(App);
    await fireEvent.click(
      screen.getByRole("button", { name: "Refresh token now" }),
    );
    expect(refresh).toHaveBeenCalled();
  });
});

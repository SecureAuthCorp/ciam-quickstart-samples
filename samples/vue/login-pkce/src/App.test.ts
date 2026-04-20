import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const isLoading = ref(false);
const isAuthenticated = ref(false);
const user = ref<any>(null);
const error = ref<Error | null>(null);
const signinRedirect = vi.fn();
const signoutRedirect = vi.fn();

vi.mock("./auth", () => ({
  useAuth: () => ({
    isLoading,
    isAuthenticated,
    user,
    error,
    signinRedirect,
    signoutRedirect,
  }),
}));

import App from "./App.vue";

describe("App (Login PKCE)", () => {
  beforeEach(() => {
    isLoading.value = false;
    isAuthenticated.value = false;
    user.value = null;
    error.value = null;
    signinRedirect.mockReset();
    signoutRedirect.mockReset();
  });

  afterEach(() => cleanup());

  it("renders sign in button when not authenticated", () => {
    render(App);
    expect(screen.getByRole("heading")).toHaveTextContent(
      "SecureAuth Vue PKCE Demo",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders loading state", () => {
    isLoading.value = true;
    render(App);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    error.value = new Error("Something went wrong");
    render(App);
    expect(screen.getByText("Error: Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("renders welcome message when authenticated", () => {
    isAuthenticated.value = true;
    user.value = {
      profile: {
        given_name: "Test",
        family_name: "User",
        email: "test@example.com",
      },
    };
    render(App);
    expect(
      screen.getByText("Welcome, Test User (test@example.com)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("calls signinRedirect when sign-in button is clicked", async () => {
    render(App);
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signinRedirect).toHaveBeenCalled();
  });

  it("calls signoutRedirect when sign-out button is clicked", async () => {
    isAuthenticated.value = true;
    user.value = {
      profile: { given_name: "Test", family_name: "User", email: "t@e.com" },
    };
    render(App);
    await fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signoutRedirect).toHaveBeenCalled();
  });
});

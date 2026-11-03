import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, redirect, getAccessContext, redirectAccessError, requireSession, AccessDeniedError } = vi.hoisted(() => {
  class MockAccessDeniedError extends Error {
    constructor(readonly status: 401 | 403) {
      super(status === 401 ? "Увійдіть до облікового запису." : "Недостатньо прав доступу.");
    }
  }
  return {
    client: {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
      },
    },
    redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
    getAccessContext: vi.fn(),
    redirectAccessError: vi.fn((error: unknown) => {
      if (error instanceof MockAccessDeniedError) {
        throw new Error(`redirect:${error.status === 401 ? "/login" : "/unauthorized"}`);
      }
      throw error;
    }),
    requireSession: vi.fn(),
    AccessDeniedError: MockAccessDeniedError,
  };
});

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/validation", async () => import("../../src/lib/auth/validation"));
vi.mock("@/lib/auth/errors", async () => import("../../src/lib/auth/errors"));
vi.mock("@/lib/auth/permissions", () => ({
  getAccessContext,
  redirectAccessError,
  requireSession,
  AccessDeniedError,
}));

import { AuthApiError } from "@supabase/supabase-js";
import { loginAction, logoutAction, recoveryAction, setPasswordAction } from "../../src/app/(auth)/actions";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hq.example.org");
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    client.auth.updateUser.mockResolvedValue({ error: null });
    getAccessContext.mockResolvedValue({ user: { id: "user" } });
    requireSession.mockResolvedValue({ supabase: client, user: { id: "user" } });
  });

  it("loginAction validates input", async () => {
    const formData = new FormData();
    formData.set("email", "bad");
    formData.set("password", "short");
    const result = await loginAction({}, formData);
    expect(result).toHaveProperty("error");
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("loginAction returns translated error on invalid credentials", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.org");
    formData.set("password", "password12345");
    client.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    const result = await loginAction({}, formData);
    expect(result).toEqual({ error: "Неправильна електронна адреса або пароль." });
  });

  it("loginAction verifies access context and redirects to / on success", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.org");
    formData.set("password", "password12345");
    await expect(loginAction({}, formData)).rejects.toThrow("redirect:/");
    expect(getAccessContext).toHaveBeenCalled();
  });

  it("loginAction redirects to /unauthorized when user has no roles", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.org");
    formData.set("password", "password12345");
    getAccessContext.mockRejectedValue(new AccessDeniedError(403));
    await expect(loginAction({}, formData)).rejects.toThrow("redirect:/unauthorized");
  });

  it("logoutAction signs out and redirects to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("redirect:/login");
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("recoveryAction validates email and sends reset email", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.org");
    const result = await recoveryAction({}, formData);
    expect(result).toHaveProperty("success");
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.org", {
      redirectTo: "https://hq.example.org/auth/callback",
    });
  });

  it("setPasswordAction validates password and updates user, redirecting to /", async () => {
    const formData = new FormData();
    formData.set("password", "new-password-1234");
    formData.set("confirmation", "new-password-1234");
    await expect(setPasswordAction({}, formData)).rejects.toThrow("redirect:/");
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1234" });
  });
});

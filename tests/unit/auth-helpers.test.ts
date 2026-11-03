import { describe, expect, it } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { authErrorMessage, isMissingSessionError } from "../../src/lib/auth/errors";
import { activeUpdateSchema, getSiteUrl, invitationSchema, roleUpdateSchema, setPasswordSchema } from "../../src/lib/auth/validation";

describe("auth validation", () => {
  it.each(["https://hq.example.org", "http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])("allows configured origin %s", (url) => {
    expect(getSiteUrl(url)).toBe(url);
  });
  it.each(["", "//evil.example", "javascript:alert(1)", "http://hq.example.org", "https://user:pass@hq.example.org", "https://hq.example.org/path", "https://hq.example.org?next=evil", "https://hq.example.org#fragment", "http://localhost.evil.example"])("rejects unsafe site URL %s", (url) => {
    expect(() => getSiteUrl(url)).toThrow();
  });
  it("requires a valid invitation and at least one known role", () => {
    const input = { email: "user@example.org", displayName: "Ім’я", roles: ["coordinator", "finance"] };
    expect(invitationSchema.safeParse(input).success).toBe(true);
    expect(invitationSchema.safeParse({ ...input, roles: [] }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...input, roles: ["superadmin"] }).success).toBe(false);
    expect(invitationSchema.safeParse({ ...input, email: "bad" }).success).toBe(false);
  });
  it("allows removing all roles but rejects invalid UUID and coerced active values", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(roleUpdateSchema.safeParse({ userId, roles: [] }).success).toBe(true);
    expect(roleUpdateSchema.safeParse({ userId: "bad", roles: [] }).success).toBe(false);
    expect(activeUpdateSchema.safeParse({ userId, active: "false" }).success).toBe(true);
    expect(activeUpdateSchema.safeParse({ userId, active: "on" }).success).toBe(false);
  });
  it("requires long matching passwords", () => {
    expect(setPasswordSchema.safeParse({ password: "long-password", confirmation: "long-password" }).success).toBe(true);
    expect(setPasswordSchema.safeParse({ password: "short", confirmation: "short" }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: "long-password", confirmation: "different" }).success).toBe(false);
  });
});

describe("Auth errors", () => {
  it("identifies expired or missing sessions but not technical faults", () => {
    expect(isMissingSessionError(new AuthSessionMissingError())).toBe(true);
    expect(isMissingSessionError(new AuthApiError("expired", 400, "refresh_token_not_found"))).toBe(true);
    expect(isMissingSessionError(new AuthApiError("unavailable", 503, "service_unavailable"))).toBe(false);
  });
  it("translates expected errors without returning provider text", () => {
    expect(authErrorMessage(new AuthApiError("provider message", 400, "invalid_credentials"))).toBe("Неправильна електронна адреса або пароль.");
  });
  it("propagates outages and unexpected failures", () => {
    const failure = new AuthApiError("unavailable", 503, "service_unavailable");
    expect(() => authErrorMessage(failure)).toThrow(failure);
    const unexpected = new Error("unexpected");
    expect(() => authErrorMessage(unexpected)).toThrow(unexpected);
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, redirect } = vi.hoisted(() => ({
  client: { auth: { getUser: vi.fn() }, rpc: vi.fn() },
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));
vi.mock("../../src/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client }));
vi.mock("next/navigation", () => ({ redirect }));

import { AccessDeniedError, requirePagePermission, requirePermission } from "../../src/lib/auth/permissions";

describe("permission guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    client.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("uses verified user and the exact SQL permission parameter", async () => {
    await expect(requirePermission("inspections.create")).resolves.toHaveProperty("user.id", "user");
    expect(client.rpc).toHaveBeenCalledWith("has_permission", { permission_code: "inspections.create" });
  });

  it("rejects missing users before querying permissions", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requirePermission("assets.read")).rejects.toMatchObject({ status: 401 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([false, null, undefined, "true", 1])("fails closed for %s", async (allowed) => {
    client.rpc.mockResolvedValue({ data: allowed, error: null });
    await expect(requirePermission("assets.read")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("does not turn database failures into forbidden redirects", async () => {
    const failure = new Error("database unavailable");
    client.rpc.mockResolvedValue({ data: null, error: failure });
    await expect(requirePagePermission("assets.read")).rejects.toBe(failure);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not turn Auth outages into missing sessions", async () => {
    const failure = new Error("network unavailable");
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: failure });
    await expect(requirePagePermission("assets.read")).rejects.toBe(failure);
  });

  it("redirects only known access errors", async () => {
    client.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requirePagePermission("assets.read")).rejects.toThrow("redirect:/unauthorized");
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requirePagePermission("assets.read")).rejects.toThrow("redirect:/login");
  });
});
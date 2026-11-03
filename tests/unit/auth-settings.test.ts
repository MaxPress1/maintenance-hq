import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, createAdmin, invite, rpc, revalidatePath, AccessDeniedError } = vi.hoisted(() => ({
  requirePermission: vi.fn(), createAdmin: vi.fn(), invite: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(),
  AccessDeniedError: class extends Error { constructor(readonly status: number) { super("Недостатньо прав доступу."); } },
}));
vi.mock("@/lib/auth/permissions", () => ({ requirePermission, AccessDeniedError }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: createAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/validation", async () => import("../../src/lib/auth/validation"));
vi.mock("@/lib/auth/errors", async () => import("../../src/lib/auth/errors"));

import { inviteUserAction, updateUserActiveAction, updateUserRolesAction } from "../../src/app/(app)/settings/actions";

const userId = "11111111-1111-4111-8111-111111111111";
function invitation() {
  const form = new FormData();
  form.set("email", "user@example.org");
  form.set("displayName", "Користувач");
  form.append("roles", "worker");
  form.append("roles", "finance");
  return form;
}

describe("administration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hq.example.org");
    requirePermission.mockResolvedValue({ supabase: { rpc } });
    createAdmin.mockReturnValue({ auth: { admin: { inviteUserByEmail: invite } } });
    invite.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({ error: null });
  });

  it.each(["users.invite", "roles.manage"])("does not create service client without %s", async (denied) => {
    requirePermission.mockImplementation(async (permission) => {
      if (permission === denied) throw new AccessDeniedError(403);
      return { supabase: { rpc } };
    });
    expect(await inviteUserAction({}, invitation())).toHaveProperty("error");
    expect(createAdmin).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
  });

  it("checks permissions first, uses fixed callback and assigns multiple roles through JWT RPC", async () => {
    expect(await inviteUserAction({}, invitation())).toHaveProperty("success");
    expect(requirePermission.mock.calls).toEqual([["users.invite"], ["roles.manage"]]);
    expect(createAdmin.mock.invocationCallOrder[0]).toBeGreaterThan(requirePermission.mock.invocationCallOrder[1]);
    expect(invite).toHaveBeenCalledWith("user@example.org", { data: { display_name: "Користувач" }, redirectTo: "https://hq.example.org/auth/callback" });
    expect(rpc).toHaveBeenCalledWith("set_user_roles", { target_user_id: userId, role_codes: ["worker", "finance"] });
  });

  it("rejects malformed invitations before creating the service client", async () => {
    const form = invitation();
    form.set("roles", "administrator-typo");
    expect(await inviteUserAction({}, form)).toHaveProperty("error");
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it.each(["returned", "thrown"])("reports partial success on %s role assignment failure", async (mode) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("database offline");
    if (mode === "returned") rpc.mockResolvedValue({ error: failure });
    else rpc.mockRejectedValue(failure);
    const result = await inviteUserAction({}, invitation());
    expect(result.error).toContain("Запрошення вже створено");
    expect(result.error).toContain(userId);
    expect(result.error).toContain("перевірте поточні ролі");
    expect(invite).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not hide an unexpected guard error as forbidden", async () => {
    const failure = new Error("network");
    requirePermission.mockRejectedValue(failure);
    await expect(inviteUserAction({}, invitation())).rejects.toBe(failure);
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("allows removing all roles and never uses service credentials", async () => {
    const form = new FormData();
    form.set("userId", userId);
    expect(await updateUserRolesAction({}, form)).toHaveProperty("success");
    expect(rpc).toHaveBeenCalledWith("set_user_roles", { target_user_id: userId, role_codes: [] });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("passes literal false, not truthiness of the submitted string", async () => {
    const form = new FormData();
    form.set("userId", userId);
    form.set("active", "false");
    expect(await updateUserActiveAction({}, form)).toHaveProperty("success");
    expect(rpc).toHaveBeenCalledWith("set_profile_active", { target_user_id: userId, active: false });
  });

  it("explains last-administrator protection and propagates unknown SQL errors", async () => {
    const form = new FormData();
    form.set("userId", userId);
    rpc.mockResolvedValueOnce({ error: { code: "23514" } });
    expect((await updateUserRolesAction({}, form)).error).toContain("останнього активного адміністратора");
    const failure = { code: "XX000", message: "database fault" };
    rpc.mockResolvedValueOnce({ error: failure });
    await expect(updateUserRolesAction({}, form)).rejects.toBe(failure);
  });
});
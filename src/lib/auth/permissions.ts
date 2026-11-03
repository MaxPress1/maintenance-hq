import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { isMissingSessionError } from "./errors";

export type PermissionCode =
  | "profiles.read"
  | "users.invite"
  | "roles.manage"
  | "assets.read"
  | "assets.manage"
  | "inspections.read"
  | "inspections.create"
  | "audit.read"
  | "work_orders.read"
  | "work_orders.manage"
  | "work_orders.execute"
  | "planning.read"
  | "planning.manage"
  | "finance.read"
  | "finance.manage"
  | "materials.read"
  | "materials.manage"
  | "reports.read";

export class AccessDeniedError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Увійдіть до облікового запису." : "Недостатньо прав доступу.");
  }
}

export async function requireSession() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError && !isMissingSessionError(userError)) throw userError;
  if (userError || !userResult.user) {
    throw new AccessDeniedError(401);
  }

  return { supabase, user: userResult.user };
}

export async function requirePermission(permission: PermissionCode) {
  const { supabase, user } = await requireSession();
  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    permission_code: permission,
  });

  if (permissionError) throw permissionError;
  if (allowed !== true) {
    throw new AccessDeniedError(403);
  }

  return { supabase, user };
}

export async function getAccessContext() {
  const { supabase, user } = await requireSession();
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id, display_name, is_active").eq("id", user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.is_active !== true) throw new AccessDeniedError(403);

  const { data: memberships, error: rolesError } = await supabase.from("user_roles")
    .select("role_code").eq("user_id", user.id);
  if (rolesError) throw rolesError;
  if (!memberships?.length) throw new AccessDeniedError(403);
  const roles = memberships.map((membership) => membership.role_code as string);
  const { data: grants, error: grantsError } = await supabase.from("role_permissions")
    .select("permission_code").in("role_code", roles);
  if (grantsError) throw grantsError;
  const permissions = [...new Set((grants ?? []).map((grant) => grant.permission_code as PermissionCode))];
  return { supabase, user, profile, roles, permissions };
}

export function redirectAccessError(error: unknown): never {
  if (error instanceof AccessDeniedError) {
    redirect(error.status === 401 ? "/login" : "/unauthorized");
  }
  throw error;
}

export async function requirePageSession() {
  try {
    return await getAccessContext();
  } catch (error) {
    redirectAccessError(error);
  }
}

export async function requirePagePermission(permission: PermissionCode) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    redirectAccessError(error);
  }
}

import { ActionForm } from "@/components/ui/action-form";
import { RoleFields } from "@/components/auth/role-fields";
import { requirePagePermission } from "@/lib/auth/permissions";
import { inviteUserAction, updateUserActiveAction, updateUserRolesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user } = await requirePagePermission("roles.manage");
  const { data: canInvite, error: inviteError } = await supabase.rpc("has_permission", { permission_code: "users.invite" });
  if (inviteError) throw inviteError;
  const { data: profiles, error: profilesError } = await supabase.from("profiles")
    .select("id, display_name, is_active").order("created_at").limit(100);
  if (profilesError) throw profilesError;
  const { data: memberships, error: rolesError } = await supabase.from("user_roles")
    .select("user_id, role_code").in("user_id", (profiles ?? []).map((profile) => profile.id));
  if (rolesError) throw rolesError;

  return <div className="stack">
    <h1>Користувачі та доступ</h1>
    <p className="muted">Права кількох ролей об’єднуються. Неактивний користувач або користувач без ролей не має доступу. Останнього активного адміністратора захищає база даних.</p>
    {canInvite === true && <section className="card stack">
      <h2>Запросити користувача</h2>
      <ActionForm action={inviteUserAction} submitLabel="Надіслати запрошення" className="stack">
        <div className="form-grid">
          <label className="field">Ім’я<input name="displayName" maxLength={200} autoComplete="name" required /></label>
          <label className="field">Електронна адреса<input name="email" type="email" maxLength={254} autoComplete="email" required /></label>
        </div>
        <RoleFields />
      </ActionForm>
    </section>}
    <h2>Облікові записи</h2>
    {(profiles ?? []).map((profile) => {
      const selected = (memberships ?? []).filter((membership) => membership.user_id === profile.id).map((membership) => membership.role_code as string);
      return <section className="card stack" key={`${profile.id}:${profile.is_active}:${selected.slice().sort().join(",")}`}>
        <h3>{profile.display_name || "Без імені"}{profile.id === user.id ? " (ви)" : ""}</h3>
        <p className="muted">ID: {profile.id}</p>
        <p><span className="pill">{profile.is_active ? "Активний" : "Неактивний"}</span>{!selected.length && " · Без ролей"}</p>
        <ActionForm action={updateUserRolesAction} submitLabel="Зберегти ролі" className="stack" confirmMessage="Зберегти новий набір ролей? Зняття всіх ролей закриє доступ користувача.">
          <input type="hidden" name="userId" value={profile.id} />
          <RoleFields selected={selected} />
        </ActionForm>
        <ActionForm action={updateUserActiveAction} submitLabel={profile.is_active ? "Деактивувати" : "Активувати"} confirmMessage={profile.is_active ? "Закрити користувачу доступ до системи?" : "Відновити активність користувача?"}>
          <input type="hidden" name="userId" value={profile.id} />
          <input type="hidden" name="active" value={profile.is_active ? "false" : "true"} />
        </ActionForm>
      </section>;
    })}
    {profiles?.length === 100 && <p className="notice">Показано перші 100 облікових записів. Для більшої команди потрібна пагінація.</p>}
  </div>;
}
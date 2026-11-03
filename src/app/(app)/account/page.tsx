import { ActionForm } from "@/components/ui/action-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { requirePageSession } from "@/lib/auth/permissions";
import { roleLabels } from "@/lib/auth/validation";
import { setPasswordAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await requirePageSession();
  const { user, profile, roles, permissions } = context;

  return (
    <div className="stack gap-6">
      <div className="page-title">
        <div>
          <span className="eyebrow">Особистий профіль</span>
          <h1 className="page-heading">Обліковий запис</h1>
        </div>
        <div className="button-row items-center">
          <LogoutButton />
        </div>
      </div>

      <section className="card stack">
        <h2>Дані користувача</h2>
        <dl className="details-grid">
          <div>
            <dt>Ім’я користувача</dt>
            <dd className="font-semibold">{profile.display_name || "Не вказано"}</dd>
          </div>
          <div>
            <dt>Електронна адреса</dt>
            <dd className="font-semibold">{user.email}</dd>
          </div>
          <div>
            <dt>Ідентифікатор (UUID)</dt>
            <dd className="muted break-anywhere">{user.id}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className="pill">{profile.is_active ? "Активний" : "Неактивний"}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card stack">
        <h2>Призначені ролі</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <span key={role} className="pill font-semibold">
              {roleLabels[role as keyof typeof roleLabels] ?? role}
            </span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Зміна пароля</h2>
        <p className="muted">Введіть новий пароль для вашого облікового запису (щонайменше 12 символів).</p>
        <ActionForm action={setPasswordAction} submitLabel="Оновити пароль" className="stack">
          <div className="form-grid">
            <label className="field">
              Новий пароль
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label className="field">
              Повторіть пароль
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Дозволи в системі ({permissions.length})</h2>
        <div className="flex flex-wrap gap-2">
          {permissions.map((perm) => (
            <code key={perm} className="pill text-xs">
              {perm}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}

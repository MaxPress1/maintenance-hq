import { ActionForm } from "@/components/ui/action-form";
import { redirectAccessError, requireSession } from "@/lib/auth/permissions";
import { setPasswordAction } from "../actions";

export default async function SetPasswordPage() {
  try {
    await requireSession();
  } catch (error) {
    redirectAccessError(error);
  }
  return <>
    <h1>Встановлення пароля</h1>
    <p>Створіть пароль для запрошеного облікового запису або замініть забутий. Щонайменше 12 символів.</p>
    <ActionForm action={setPasswordAction} submitLabel="Зберегти пароль" className="stack">
      <label className="field">Новий пароль<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label className="field">Повторіть пароль<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    </ActionForm>
  </>;
}
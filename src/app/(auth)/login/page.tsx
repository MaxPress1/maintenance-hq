import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "../actions";

export default function LoginPage() {
  return <>
    <h1>Вхід</h1>
    <p className="muted">Доступ лише за запрошенням адміністратора.</p>
    <ActionForm action={loginAction} submitLabel="Увійти" className="stack">
      <label className="field">Електронна адреса<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
      <label className="field">Пароль<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
    </ActionForm>
    <Link href="/recovery">Забули пароль?</Link>
  </>;
}
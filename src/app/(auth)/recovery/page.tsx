import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { recoveryAction } from "../actions";

export default function RecoveryPage() {
  return <>
    <h1>Відновлення доступу</h1>
    <p>Вкажіть адресу, на яку ви отримували запрошення.</p>
    <ActionForm action={recoveryAction} submitLabel="Надіслати посилання" className="stack">
      <label className="field">Електронна адреса<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    </ActionForm>
    <Link href="/login">Повернутися до входу</Link>
  </>;
}
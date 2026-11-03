import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return <main className="auth-card card stack">
    <h1>Доступ обмежено</h1>
    <p className="notice notice-error" role="alert">Обліковий запис неактивний, не має призначених ролей або потрібного дозволу. Зверніться до адміністратора.</p>
    <Link href="/">До головної панелі</Link>
    <LogoutButton />
  </main>;
}
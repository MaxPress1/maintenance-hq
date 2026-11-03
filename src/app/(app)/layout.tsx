import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect("/setup");
  const { supabase, user } = await requirePagePermission("assets.read");
  const { data: admin } = await supabase.rpc("has_permission", { permission_code: "roles.manage" });
  return <div className="shell">
    <a className="skip-link" href="#main-content">Перейти до вмісту</a>
    <header className="topbar">
      <Link className="brand" href="/">Maintenance HQ</Link>
      <nav className="nav" aria-label="Головна навігація">
        <Link href="/">Головна</Link>
        <Link href="/work-orders">Заявки та роботи</Link>
        <Link href="/planning">Планування</Link>
        <Link href="/assets">Об’єкти</Link>
        <Link href="/budget">Бюджет</Link>
        <Link href="/materials">Матеріали</Link>
        <Link href="/reports">Звіти</Link>
        {admin && <Link href="/settings">Налаштування</Link>}
        <Link href="/account">Обліковий запис</Link>
      </nav>
      <span className="muted user-label">{user.email}</span>
    </header>
    <main className="container" id="main-content">{children}</main>
    <footer className="container footer-note muted">Maintenance HQ · Захищений облік території · Часовий пояс Europe/Kyiv</footer>
  </div>;
}

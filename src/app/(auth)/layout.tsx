import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-card card stack"><p className="muted">Maintenance HQ</p>{children}</main>;
}
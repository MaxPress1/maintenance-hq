import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { uuidSchema } from "@/lib/validation";
import { formatDate } from "@/lib/dates";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ record?: string; page?: string }> }) {
  const params = await searchParams;
  const record = uuidSchema.safeParse(params.record).success ? params.record! : "";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page || "", 10) || 1));
  const { supabase } = await requirePagePermission("audit.read");
  let query = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (record) query = query.eq("record_id", record);
  const { data, error, count } = await query.range((page - 1) * 50, page * 50 - 1);
  if (error) throw error;
  const operations: Record<string, string> = { INSERT: "Створення", UPDATE: "Зміна", DELETE: "Видалення зв’язку" };
  return <div className="stack"><h1 className="page-heading">Журнал змін</h1>
    <p className="muted">Незмінні знімки записів до та після операції. Час — Europe/Kyiv. Кількість подій: {count}.</p>
    {record && <p>Фільтр за записом: <code className="break-anywhere">{record}</code> · <Link href="/audit">Усі події</Link></p>}
    {!data.length && <p className="card">Подій не знайдено.</p>}
    {data.map((entry) => <details className="card" key={entry.id}><summary>{formatDate(entry.created_at)} {new Date(entry.created_at).toLocaleTimeString("uk-UA", { timeZone: "Europe/Kyiv" })} · {operations[entry.operation]} · {entry.table_name}</summary>
      <p className="break-anywhere">Запис: {entry.record_id}<br />Автор: {entry.actor_id || "Системна операція"}</p>
      <div className="grid two-columns"><div><h3>До</h3><pre className="json-data">{JSON.stringify(entry.old_data, null, 2)}</pre></div><div><h3>Після</h3><pre className="json-data">{JSON.stringify(entry.new_data, null, 2)}</pre></div></div>
    </details>)}
    <nav className="button-row" aria-label="Сторінки журналу">{page > 1 && <Link href={`/audit?record=${record}&page=${page - 1}`}>Попередня</Link>}<span>Сторінка {page}</span>{page * 50 < (count || 0) && <Link href={`/audit?record=${record}&page=${page + 1}`}>Наступна</Link>}</nav>
  </div>;
}

import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { ActionForm } from "@/components/ui/action-form";
import { saveSite } from "@/features/assets/actions";
import { ArchiveForm } from "@/features/assets/archive-form";
import type { Site } from "@/features/assets/schema";

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase } = await requirePagePermission("assets.read");
  const page = Math.min(100000, Math.max(1, Number.parseInt((await searchParams).page || "", 10) || 1));
  const [sites, manage] = await Promise.all([
    supabase.from("sites").select("*", { count: "exact" }).order("name").order("id").range((page - 1) * 50, page * 50 - 1),
    supabase.rpc("has_permission", { permission_code: "assets.manage" }),
  ]);
  if (sites.error || manage.error) throw new Error("Не вдалося завантажити території.");
  return <div className="stack"><h1 className="page-heading">Території</h1>
    {manage.data && <section className="card"><h2>Додати територію</h2>
      <ActionForm action={saveSite} submitLabel="Створити територію">
        <input type="hidden" name="request_id" value={randomUUID()} />
        <label className="field">Назва<input name="name" maxLength={200} required /></label>
        <label className="field">Опис<textarea name="description" maxLength={5000} /></label>
      </ActionForm>
    </section>}
    {!sites.data.length && <p className="card">Територій ще немає. Адміністратор або координатор може створити першу.</p>}
    {(sites.data as Site[]).map((site) => <section className="card" key={site.id}>
      <div className="page-title"><h2>{site.name}</h2>{site.archived_at && <span className="pill">Архів</span>}</div>
      <p className="pre-wrap">{site.description || "Опис не додано."}</p>
      <Link href={`/assets?site=${site.id}&archived=${site.archived_at ? "1" : ""}`}>Переглянути об’єкти території</Link>
      {manage.data && <details className="section-details"><summary>Керування територією</summary>
        {!site.archived_at && <ActionForm action={saveSite} submitLabel="Зберегти зміни">
          <input type="hidden" name="id" value={site.id} /><input type="hidden" name="updated_at" value={site.updated_at} />
          <label className="field">Назва<input name="name" required maxLength={200} defaultValue={site.name} /></label>
          <label className="field">Опис<textarea name="description" maxLength={5000} defaultValue={site.description} /></label>
        </ActionForm>}
        <p className="muted">Архівування доступне після архівування всіх об’єктів території. Історія не видаляється.</p>
        <ArchiveForm table="sites" record={site} />
      </details>}
    </section>)}
    <nav className="button-row" aria-label="Сторінки територій">{page > 1 && <Link href={`/sites?page=${page - 1}`}>Попередня</Link>}<span>Сторінка {page}</span>{page * 50 < (sites.count || 0) && <Link href={`/sites?page=${page + 1}`}>Наступна</Link>}</nav>
  </div>;
}

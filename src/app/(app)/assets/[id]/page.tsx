import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/permissions";
import { uuidSchema } from "@/lib/validation";
import { formatDate } from "@/lib/dates";
import { ActionForm } from "@/components/ui/action-form";
import { recordInspection } from "@/features/assets/actions";
import { ArchiveForm } from "@/features/assets/archive-form";
import { assetTypes, conditions, type Asset } from "@/features/assets/schema";

export default async function AssetPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const page = Math.min(100000, Math.max(1, Number.parseInt((await searchParams).page || "", 10) || 1));
  const { supabase } = await requirePagePermission("assets.read");
  const { data, error } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const asset = data as Asset;
  const [site, profile, parent, manage, inspect, audit, history] = await Promise.all([
    supabase.from("sites").select("name").eq("id", asset.site_id).maybeSingle(),
    asset.responsible_id ? supabase.from("profiles").select("display_name").eq("id", asset.responsible_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    asset.parent_id ? supabase.from("assets").select("name").eq("id", asset.parent_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.rpc("has_permission", { permission_code: "assets.manage" }),
    supabase.rpc("has_permission", { permission_code: "inspections.create" }),
    supabase.rpc("has_permission", { permission_code: "audit.read" }),
    supabase.from("inspections").select("*", { count: "exact" }).eq("asset_id", id).order("inspected_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1),
  ]);
  if ([site, profile, parent, manage, inspect, audit, history].some((result) => result.error)) throw new Error("Не вдалося завантажити картку об’єкта.");
  return <div className="stack"><Link href="/assets">← Об’єкти</Link>
    <div className="page-title"><h1 className="page-heading">{asset.name}</h1><span className={`pill ${asset.condition === "critical" ? "critical" : ""}`}>{conditions[asset.condition]}</span></div>
    {asset.archived_at && <p className="notice">Об’єкт в архіві з {formatDate(asset.archived_at)}. Для редагування відновіть його.</p>}
    <section className="card"><dl className="details-grid">
      <div><dt>Територія</dt><dd>{site.data?.name}</dd></div><div><dt>Тип</dt><dd>{assetTypes[asset.type as keyof typeof assetTypes] || asset.type}</dd></div>
      <div><dt>Батьківський об’єкт</dt><dd>{asset.parent_id ? <Link href={`/assets/${asset.parent_id}`}>{parent.data?.name || "Переглянути"}</Link> : "Немає"}</dd></div>
      <div><dt>Відповідальний</dt><dd>{profile.data?.display_name || asset.responsible_id || "Не призначено"}</dd></div>
      <div><dt>Розташування</dt><dd>{asset.location_description || "Не вказано"}</dd></div>
      <div><dt>Останній огляд</dt><dd>{formatDate(asset.last_inspected_at)}</dd></div><div><dt>Наступний огляд</dt><dd>{formatDate(asset.next_inspection_at)}</dd></div>
      <div><dt>Ідентифікатор</dt><dd className="break-anywhere">{asset.id}</dd></div>
    </dl><p className="pre-wrap">{asset.description || "Опис не додано."}</p>
      <div className="button-row">{manage.data && !asset.archived_at && <Link className="button" href={`/assets/${id}/edit`}>Редагувати</Link>}{audit.data && <Link className="button button-secondary" href={`/audit?record=${id}`}>Історія змін</Link>}</div>
    </section>
    {inspect.data && !asset.archived_at && <section className="card"><h2>Зареєструвати огляд</h2><p className="muted">Дата й автор фіксуються автоматично. Результат огляду змінить технічний стан об’єкта.</p>
      <ActionForm action={recordInspection} submitLabel="Зберегти огляд"><input type="hidden" name="request_id" value={randomUUID()} /><input type="hidden" name="asset_id" value={id} />
        <div className="form-grid"><label className="field">Стан після огляду<select name="condition" defaultValue={asset.condition}>{Object.entries(conditions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label className="field">Наступний огляд<input type="date" name="next_inspection_date" /></label></div>
        <label className="field">Результат і зауваження<textarea name="notes" required maxLength={5000} /></label>
      </ActionForm>
    </section>}
    <section className="card"><h2>Історія оглядів</h2>{history.data?.length ? <ol className="record-list">{history.data.map((item) => <li className="history-entry" key={item.id}>
      <strong>{formatDate(item.inspected_at)} · {conditions[item.condition as keyof typeof conditions]}</strong><p className="pre-wrap">{item.notes}</p><small className="muted break-anywhere">Автор: {item.inspected_by} · Наступний огляд: {formatDate(item.next_inspection_at)}</small>
    </li>)}</ol> : <p className="muted">Оглядів ще немає.</p>}
      <nav className="button-row" aria-label="Сторінки історії">{page > 1 && <Link href={`/assets/${id}?page=${page - 1}`}>Попередня</Link>}{page * 30 < (history.count || 0) && <Link href={`/assets/${id}?page=${page + 1}`}>Наступна</Link>}</nav>
    </section>
    <section className="card"><h2>Історія ремонтів і фотографії</h2><p className="muted">Буде доступна після підключення модуля заявок і приватних вкладень. Історія оглядів зберігається окремо.</p></section>
    {manage.data && <section className="card"><h2>Архівування</h2><p>Перед архівуванням батьківського об’єкта архівуйте його дочірні об’єкти. Відновлення можливе лише в активній території та під активним батьківським об’єктом.</p><ArchiveForm table="assets" record={asset} /></section>}
  </div>;
}

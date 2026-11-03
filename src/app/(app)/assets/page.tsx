import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { uuidSchema } from "@/lib/validation";
import { formatDate } from "@/lib/dates";
import { assetTypes, conditions, type Asset } from "@/features/assets/schema";
import { AssetTree } from "@/features/assets/asset-tree";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const get = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const q = get("q").slice(0, 200);
  const site = uuidSchema.safeParse(get("site")).success ? get("site") : "";
  const condition = Object.hasOwn(conditions, get("condition")) ? get("condition") : "";
  const archived = get("archived") === "1";
  const tree = get("view") === "tree";
  const page = Math.min(100000, Math.max(1, Number.parseInt(get("page"), 10) || 1));
  const size = tree ? 1000 : 50;
  const { supabase } = await requirePagePermission("assets.read");
  let query = supabase.from("assets").select("*", { count: "exact" }).order("name").order("id");
  if (!archived) query = query.is("archived_at", null);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (site) query = query.eq("site_id", site);
  if (condition) query = query.eq("condition", condition);
  const [result, sites, manage] = await Promise.all([
    query.range(tree ? 0 : (page - 1) * size, tree ? size - 1 : page * size - 1),
    supabase.from("sites").select("id, name").order("name").limit(1000),
    supabase.rpc("has_permission", { permission_code: "assets.manage" }),
  ]);
  if (result.error || sites.error || manage.error) throw new Error("Не вдалося отримати об’єкти.");
  const assets = result.data as Asset[];
  const siteNames = new Map(sites.data.map((item) => [item.id, item.name]));
  function href(changes: Record<string, string>) {
    const next = new URLSearchParams({ q, site, condition, archived: archived ? "1" : "", view: tree ? "tree" : "list", ...changes });
    return `/assets?${next}`;
  }
  return <div className="stack">
    <div className="page-title"><div><p className="eyebrow">Територія та інфраструктура</p><h1 className="page-heading">Об’єкти території</h1></div>
      {manage.data && <Link className="button" href="/assets/new">Додати об’єкт</Link>}</div>
    <form className="card form-grid" method="get">
      <input type="hidden" name="view" value={tree ? "tree" : "list"} />
      <label className="field">Пошук за назвою<input name="q" defaultValue={q} maxLength={200} placeholder="Будівля, кімната, обладнання…" /></label>
      <label className="field">Територія<select name="site" defaultValue={site}><option value="">Усі території</option>{sites.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Технічний стан<select name="condition" defaultValue={condition}><option value="">Усі стани</option>{Object.entries(conditions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" name="archived" value="1" defaultChecked={archived} /> Також архівні</label>
      <div className="button-row"><button className="button" type="submit">Застосувати</button><Link href="/assets" className="button button-secondary">Скинути</Link></div>
    </form>
    <div className="page-title"><p className="muted">Знайдено: {result.count}</p><div className="button-row"><Link className="button button-secondary" href={href({ view: "list" })}>Список</Link><Link className="button button-secondary" href={href({ view: "tree" })}>Дерево</Link></div></div>
    {!assets.length ? <section className="card"><h2>Об’єктів не знайдено</h2><p>Змініть фільтри або додайте перший об’єкт.</p></section> : tree ?
      <section className="card"><h2>Ієрархія об’єктів</h2><p className="muted">Показано лише об’єкти за вибраними фільтрами; прихований батьківський об’єкт не відображається.</p>
        {sites.data.filter((item) => assets.some((asset) => asset.site_id === item.id)).map((item) => <section key={item.id}><h3>{item.name}</h3><AssetTree assets={assets.filter((asset) => asset.site_id === item.id)} /></section>)}
        {(result.count || 0) > size && <p className="notice">Дерево обмежене першою тисячею об’єктів. Звузьте фільтр або використайте список із пагінацією.</p>}
      </section> : <section className="card table-wrap"><table><caption className="sr-only">Реєстр об’єктів</caption><thead><tr><th>Об’єкт</th><th>Територія / тип</th><th>Стан</th><th>Наступний огляд</th></tr></thead><tbody>
        {assets.map((asset) => <tr key={asset.id}><td><Link href={`/assets/${asset.id}`}>{asset.name}</Link>{asset.archived_at && <span className="pill">Архів</span>}</td><td>{siteNames.get(asset.site_id) || asset.site_id}<br /><small className="muted">{assetTypes[asset.type as keyof typeof assetTypes] || asset.type}</small></td><td><span className={`pill ${asset.condition === "critical" ? "critical" : ""}`}>{conditions[asset.condition]}</span></td><td>{formatDate(asset.next_inspection_at)}</td></tr>)}
      </tbody></table></section>}
    {!tree && <nav className="button-row" aria-label="Сторінки об’єктів">{page > 1 && <Link className="button button-secondary" href={href({ page: String(page - 1) })}>Попередня</Link>}<span>Сторінка {page}</span>{page * size < (result.count || 0) && <Link className="button button-secondary" href={href({ page: String(page + 1) })}>Наступна</Link>}</nav>}
  </div>;
}

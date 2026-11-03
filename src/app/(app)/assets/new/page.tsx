import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { assetReferences } from "@/features/assets/queries";
import { AssetForm } from "@/features/assets/asset-form";

export default async function NewAssetPage() {
  const { supabase } = await requirePagePermission("assets.manage");
  const references = await assetReferences(supabase);
  return <div className="stack"><Link href="/assets">← Об’єкти</Link><h1 className="page-heading">Новий об’єкт</h1>
    {!references.sites.length ? <section className="card"><p>Спочатку створіть територію, до якої належатиме об’єкт.</p><Link className="button" href="/sites">Керування територіями</Link></section> :
      <section className="card"><AssetForm {...references} requestId={randomUUID()} /></section>}
  </div>;
}

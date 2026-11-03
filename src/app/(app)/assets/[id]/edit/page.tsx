import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/permissions";
import { uuidSchema } from "@/lib/validation";
import { assetReferences } from "@/features/assets/queries";
import { AssetForm } from "@/features/assets/asset-form";
import type { Asset } from "@/features/assets/schema";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requirePagePermission("assets.manage");
  const [result, references] = await Promise.all([supabase.from("assets").select("*").eq("id", id).maybeSingle(), assetReferences(supabase)]);
  if (result.error) throw result.error;
  if (!result.data) notFound();
  return <div className="stack"><Link href={`/assets/${id}`}>← Картка об’єкта</Link><h1 className="page-heading">Редагування об’єкта</h1>
    <section className="card">{result.data.archived_at ? <p>Перед редагуванням відновіть об’єкт з архіву.</p> : <AssetForm asset={result.data as Asset} {...references} requestId={randomUUID()} />}</section>
  </div>;
}

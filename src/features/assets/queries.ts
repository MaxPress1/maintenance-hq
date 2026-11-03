import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Asset, Profile, Site } from "./schema";

export async function getAssets(): Promise<Asset[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .is("archived_at", null)
    .order("name")
    .limit(1000);
  if (error) {
    console.error("Error fetching assets:", error);
    return [];
  }
  return data as Asset[];
}

export async function assetReferences(supabase: SupabaseClient) {
  const [sites, assets, profiles] = await Promise.all([
    supabase.from("sites").select("*").is("archived_at", null).order("name").limit(1000),
    supabase.from("assets").select("*").is("archived_at", null).order("name").limit(1000),
    supabase.from("profiles").select("id, display_name, is_active").eq("is_active", true).order("display_name").limit(1000),
  ]);
  if (sites.error || assets.error || profiles.error) throw new Error("Не вдалося завантажити довідники.");
  return { sites: sites.data as Site[], assets: assets.data as Asset[], profiles: profiles.data as Profile[] };
}

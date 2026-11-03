import React from "react";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getMaterials } from "@/features/materials/queries";
import { MaterialsList } from "@/features/materials/materials-list";
import { MaterialForm } from "@/features/materials/material-form";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const { supabase } = await requirePagePermission("materials.read");
  const { data: canManage } = await supabase.rpc("has_permission", {
    permission_code: "materials.manage",
  });
  const materials = await getMaterials();

  return (
    <div className="stack gap-6">
      <div className="page-title">
        <div>
          <span className="eyebrow">Матеріально-технічний облік</span>
          <h1 className="page-heading">Довідник матеріалів та залишки</h1>
        </div>
      </div>

      <div className="grid two-columns gap-6">
        <MaterialsList materials={materials} canManage={Boolean(canManage)} />
        {canManage && <MaterialForm />}
      </div>
    </div>
  );
}

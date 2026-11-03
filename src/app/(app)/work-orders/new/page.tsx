import React from "react";
import { requirePagePermission } from "@/lib/auth/permissions";
import { assetReferences } from "@/features/assets/queries";
import { WorkOrderForm } from "@/features/work-orders/work-order-form";

export const dynamic = "force-dynamic";

export default async function NewWorkOrderPage() {
  const { supabase } = await requirePagePermission("work_orders.read");
  const { assets, profiles } = await assetReferences(supabase);

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Новий запис</span>
          <h1 className="page-heading">Створення заявки / планової роботи</h1>
        </div>
      </div>

      <WorkOrderForm assets={assets} profiles={profiles} />
    </div>
  );
}

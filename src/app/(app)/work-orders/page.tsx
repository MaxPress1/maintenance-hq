import React from "react";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getWorkOrders } from "@/features/work-orders/queries";
import { getAssets } from "@/features/assets/queries";
import { WorkOrderList } from "@/features/work-orders/work-order-list";
import { EmergencyReportModal } from "@/features/work-orders/emergency-modal";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  await requirePagePermission("work_orders.read");
  const [workOrders, assets] = await Promise.all([getWorkOrders(), getAssets()]);

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <span className="eyebrow">Реєстр ремонтів</span>
          <h1 className="page-heading">Заявки та ремонтні роботи</h1>
        </div>
        <div className="button-row">
          <EmergencyReportModal assets={assets} />
          <Link href="/work-orders/new" className="button">
            + Створити роботу
          </Link>
        </div>
      </div>

      <WorkOrderList workOrders={workOrders} />
    </div>
  );
}

import { z } from "zod";

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  estimated_price: number;
  stock_quantity: number;
  min_stock_level: number;
  supplier: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialRequest {
  id: string;
  work_order_id: string;
  material_id: string;
  requested_quantity: number;
  created_at: string;
  material?: Material;
}

export interface MaterialUsage {
  id: string;
  work_order_id: string;
  material_id: string;
  used_quantity: number;
  used_at: string;
  used_by: string | null;
  material?: Material;
  user?: { display_name: string };
}

export const materialSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву матеріалу").max(200),
  category: z.string().trim().min(1).max(100).default("Загальне"),
  unit: z.string().trim().min(1, "Вкажіть одиницю виміру").max(20).default("шт"),
  estimated_price: z.coerce.number().min(0, "Ціна не може бути від'ємною").default(0),
  stock_quantity: z.coerce.number().min(0, "Кількість не може бути від'ємною").default(0),
  min_stock_level: z.coerce.number().min(0, "Мінімальний залишок не може бути від'ємним").default(0),
  supplier: z.string().trim().max(200).default(""),
});

export const stockAdjustmentSchema = z.object({
  material_id: z.string().uuid(),
  delta: z.coerce.number().refine((v) => v !== 0, "Зміна залишку не може бути нульовою"),
  reason: z.string().trim().min(3, "Вкажіть причину коригування (мінімум 3 символи)").max(1000),
});

export const materialRequestSchema = z.object({
  work_order_id: z.string().uuid(),
  material_id: z.string().uuid("Оберіть матеріал"),
  requested_quantity: z.coerce.number().positive("Кількість має бути більше 0"),
});

export const materialUsageSchema = z.object({
  work_order_id: z.string().uuid(),
  material_id: z.string().uuid("Оберіть матеріал"),
  used_quantity: z.coerce.number().positive("Кількість має бути більше 0"),
});

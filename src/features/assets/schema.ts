import { z } from "zod";

export const assetTypes = {
  territory: "Територія", zone: "Зона", building: "Будівля", floor: "Поверх", room: "Приміщення",
  roof: "Дах", electricity: "Електромережа", water: "Водопостачання", sewerage: "Каналізація",
  heating: "Опалення", ventilation: "Вентиляція", equipment: "Обладнання", other: "Інше",
} as const;
export const conditions = { unknown: "Не визначено", good: "Добрий", fair: "Задовільний", poor: "Потребує ремонту", critical: "Критичний" } as const;
const optionalId = z.union([z.literal(""), z.guid()]).transform((value) => value || null);
const optionalDate = z.union([z.literal(""), z.iso.date()]);

export const siteSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву.").max(200, "Назва — до 200 символів."),
  description: z.string().trim().max(5000, "Опис — до 5000 символів."),
});
export const assetSchema = siteSchema.extend({
  site_id: z.guid("Оберіть територію."),
  parent_id: optionalId,
  type: z.enum(Object.keys(assetTypes) as [keyof typeof assetTypes, ...(keyof typeof assetTypes)[]]),
  condition: z.enum(Object.keys(conditions) as [keyof typeof conditions, ...(keyof typeof conditions)[]]),
  location_description: z.string().trim().max(1000),
  responsible_id: optionalId,
  next_inspection_date: optionalDate,
});
export const inspectionSchema = z.object({
  asset_id: z.guid(),
  condition: z.enum(Object.keys(conditions) as [keyof typeof conditions, ...(keyof typeof conditions)[]]),
  next_inspection_date: optionalDate,
  notes: z.string().trim().min(1, "Опишіть результат огляду.").max(5000),
});

export type Site = { id: string; name: string; description: string; archived_at: string | null; updated_at: string };
export type Asset = {
  id: string; name: string; type: string; site_id: string; parent_id: string | null;
  condition: keyof typeof conditions; location_description: string; description: string;
  responsible_id: string | null; last_inspected_at: string | null; next_inspection_at: string | null;
  archived_at: string | null; updated_at: string;
};
export type Profile = { id: string; display_name: string; is_active: boolean };

export function parentOptions(assets: Asset[], siteId: string, currentId?: string) {
  const excluded = new Set<string>(currentId ? [currentId] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const asset of assets) {
      if (asset.parent_id && excluded.has(asset.parent_id) && !excluded.has(asset.id)) {
        excluded.add(asset.id);
        changed = true;
      }
    }
  }
  return assets.filter((asset) => asset.site_id === siteId && !asset.archived_at && !excluded.has(asset.id));
}
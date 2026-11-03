import { z } from "zod";

export const uuidSchema = z.guid();
export const optionalUuidSchema = z.union([z.literal(""), z.guid()]).transform((value) => value || null);

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

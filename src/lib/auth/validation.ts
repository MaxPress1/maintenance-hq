import { z } from "zod";

export const roleCodes = ["administrator", "coordinator", "worker", "finance"] as const;
export const roleLabels: Record<(typeof roleCodes)[number], string> = {
  administrator: "Адміністратор", coordinator: "Координатор", worker: "Виконавець", finance: "Фінансовий відповідальний",
};
export const emailSchema = z.string().trim().email("Вкажіть коректну електронну адресу.").max(254);
export const passwordSchema = z.string().min(12, "Пароль має містити щонайменше 12 символів.").max(128, "Пароль надто довгий.");
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const rolesSchema = z.array(z.enum(roleCodes)).max(4).transform((roles) => [...new Set(roles)]);
export const invitationSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1, "Вкажіть ім’я користувача.").max(200),
  roles: rolesSchema.refine((roles) => roles.length > 0, "Оберіть хоча б одну роль."),
});
export const roleUpdateSchema = z.object({ userId: z.string().uuid(), roles: rolesSchema });
export const activeUpdateSchema = z.object({ userId: z.string().uuid(), active: z.enum(["true", "false"]) });
export const setPasswordSchema = z.object({ password: passwordSchema, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, { message: "Паролі не збігаються.", path: ["confirmation"] });

export function getSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL) {
  if (!value) throw new Error("Налаштуйте NEXT_PUBLIC_SITE_URL.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_SITE_URL має бути HTTPS origin без шляху, параметрів чи облікових даних (HTTP лише localhost).");
  }
  return url.origin;
}

export function callbackUrl() {
  return new URL("/auth/callback", getSiteUrl()).toString();
}
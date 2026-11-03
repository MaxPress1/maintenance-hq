import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.BOOTSTRAP_ADMIN_USER_ID;
  if (!url || !key || !userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Задайте NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY та BOOTSTRAP_ADMIN_USER_ID (наявний Auth UUID).");
  }
  const parsedUrl = new URL(url);
  if ((parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname))) || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash || parsedUrl.pathname !== "/") {
    throw new Error("Некоректний Supabase URL: використайте HTTPS origin або локальний HTTP origin.");
  }
  const supabase = createClient(parsedUrl.origin, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !data.user) throw new Error("Наявного Auth-користувача не підтверджено. Перевірте UUID, проєкт і серверний ключ.");
  const { error } = await supabase.rpc("bootstrap_administrator", { user_id: userId });
  if (error) throw new Error(`Початкове призначення не виконано (код ${error.code ?? "невідомий"}). Перевірте міграцію, активність профілю та чи bootstrap ще не завершено.`);
  console.info("Першого адміністратора призначено. Паролі не створювалися і не змінювалися.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Помилка початкового призначення адміністратора.");
  process.exitCode = 1;
});
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

export function isMissingSessionError(error: unknown) {
  return isAuthSessionMissingError(error) || (isAuthApiError(error) &&
    ["bad_jwt", "session_not_found", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned"]
      .includes(error.code ?? ""));
}

export function authErrorMessage(error: unknown): string {
  if (isMissingSessionError(error)) return "Сесія закінчилася. Увійдіть знову або отримайте нове посилання.";
  if (isAuthApiError(error) && error.status < 500) {
    switch (error.code) {
      case "invalid_credentials": return "Неправильна електронна адреса або пароль.";
      case "email_not_confirmed": return "Підтвердьте електронну адресу за посиланням у листі.";
      case "over_email_send_rate_limit":
      case "over_request_rate_limit": return "Забагато спроб. Спробуйте пізніше.";
      case "weak_password": return "Пароль недостатньо надійний. Використайте довший пароль.";
      case "same_password": return "Новий пароль має відрізнятися від попереднього.";
      case "otp_expired": return "Посилання недійсне або прострочене. Отримайте нове.";
      case "email_exists":
      case "user_already_exists": return "Користувач уже існує. Призначте йому ролі у списку користувачів.";
      default: return "Не вдалося виконати дію авторизації. Перевірте дані або спробуйте пізніше.";
    }
  }
  throw error;
}
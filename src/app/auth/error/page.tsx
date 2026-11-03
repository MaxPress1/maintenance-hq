import Link from "next/link";

export default function AuthErrorPage() {
  return <main className="auth-card card stack">
    <h1>Не вдалося підтвердити посилання</h1>
    <p role="alert">Посилання недійсне, вже використане або прострочене. Для посилань із кодом відкрийте лист у тому самому браузері, де замовляли відновлення.</p>
    <Link href="/recovery">Отримати нове посилання</Link>
    <Link href="/login">Повернутися до входу</Link>
  </main>;
}
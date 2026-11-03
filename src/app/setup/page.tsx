import Link from "next/link";

export default function SetupPage() {
  return <main className="auth-card card stack"><Link className="brand" href="/">Maintenance HQ</Link>
    <h1>Підключення до Supabase</h1>
    <p>Для роботи потрібні налаштовані авторизація й база даних. Застосунок не використовує демонстраційний обхід входу.</p>
    <ol className="stack"><li>Створіть локальний Supabase або проєкт у власному обліковому записі.</li>
      <li>Застосуйте міграції з каталогу <code>supabase/migrations</code>.</li>
      <li>Заповніть <code>.env.local</code> за прикладом <code>.env.example</code> та перезапустіть застосунок.</li>
      <li>Створіть першого адміністратора за інструкцією в <code>README.md</code>.</li></ol>
    <Link className="button" href="/login">Перейти до входу</Link>
  </main>;
}

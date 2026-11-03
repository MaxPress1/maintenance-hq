"use client";

export default function AppError({ reset }: { reset: () => void }) {
  return <section className="card stack" role="alert"><h1>Не вдалося завантажити дані</h1>
    <p>Перевірте з’єднання та доступність Supabase. Якщо помилка повторюється, зверніться до адміністратора.</p>
    <button className="button" onClick={reset}>Спробувати ще раз</button>
  </section>;
}

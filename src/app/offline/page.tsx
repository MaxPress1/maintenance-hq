import React from "react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 text-center stack border border-slate-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
          📶
        </div>
        <h1 className="text-xl font-bold text-slate-800 m-0">Відсутнє підключення до мережі</h1>
        <p className="text-sm text-slate-600">
          Maintenance HQ працює в режимі реального часу для забезпечення єдиного джерела істини.
          Будь ласка, перевірте зв’язок із мережею Інтернет.
        </p>
        <div className="pt-2">
          <Link href="/" className="button w-full">
            🔄 Спробувати оновити сторінку
          </Link>
        </div>
      </div>
    </div>
  );
}

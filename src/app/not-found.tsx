import Link from "next/link";

export default function NotFound() {
  return <main className="container card"><h1>Сторінку не знайдено</h1><p>Запис не існує або недоступний для вашого облікового запису.</p><Link className="button" href="/">На головну</Link></main>;
}

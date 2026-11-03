# Інструкція з розгортання Maintenance HQ

## 1. Системні вимоги
- **Node.js:** версія 20.x або 22.x LTS.
- **База даних:** PostgreSQL 15+ (керований кластер Supabase або локальний екземпляр).
- **Пакетний менеджер:** npm або pnpm.

## 2. Змінні середовища (.env.local)

Створіть файл `.env.local` на основі `.env.example`:

```bash
# Базові налаштування додатку
NEXT_PUBLIC_SITE_URL=https://maintenance.example.org

# Supabase підключення
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Секретний сервісний ключ (виключно для серверних дій запрошення користувачів)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Тимчасовий UUID для одноразового створення першого адміністратора
BOOTSTRAP_ADMIN_USER_ID=00000000-0000-0000-0000-000000000000
```

## 3. Застосування міграцій бази даних

Усі міграції розташовані в каталозі `supabase/migrations/`:
1. `20261029000000_foundation.sql` — базові таблиці, ролі, облік об'єктів та RLS.
2. `20261030000000_foundation_requests.sql` — ідемпотентне створення об'єктів.
3. `20261031000000_work_orders.sql` — реєстр робіт, статуси, коментарі, публічні токени.
4. `20261031010000_planning_and_materials.sql` — залежності, перенесення, матеріали.
5. `20261031020000_finance_and_budgets.sql` — бюджети, валютні операції, сторно.
6. `20261031030000_reports_and_notifications.sql` — звіти та сповіщення.

Застосуйте їх через Supabase CLI:
```bash
supabase db push
```
або виконайте SQL файли по черзі в SQL Editor у кабінеті Supabase.

## 4. Створення першого адміністратора

1. У кабінеті Supabase Auth створіть першого користувача або надішліть запрошення на його email.
2. Скопіюйте його UUID.
3. Запустіть скрипт ініціалізації:
   ```bash
   node --env-file=.env.local scripts/bootstrap-admin.mjs
   ```
4. Перший адміністратор отримує роль `administrator` та повний доступ до системи.
5. Видаліть змінну `BOOTSTRAP_ADMIN_USER_ID` після успішної ініціалізації.

## 5. Збірка та запуск

```bash
# Встановлення залежностей
npm ci

# Перевірка типів та запуск тестів
npm run typecheck
npm test

# Production збірка
npm run build

# Запуск продуктового сервера
npm start
```

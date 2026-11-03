# Доступ Maintenance HQ: перший етап

Джерело істини — міграція `20261029000000_foundation.sql`, RLS і `has_permission(permission_code)`. Права кількох ролей об’єднуються. Неактивний профіль або відсутність ролей закривають бізнес-доступ навіть із чинним JWT. Зміни ролей/активності набувають чинності на наступному серверному запиті; вже завантажені дані неможливо відкликати з екрана.

| Дозвіл | Адміністратор | Координатор | Виконавець | Фінанси |
|---|---|---|---|---|
| `assets.read` | ✓ | ✓ | ✓ | ✓ |
| `assets.manage` | ✓ | ✓ | — | — |
| `inspections.read` | ✓ | ✓ | ✓ | ✓ |
| `inspections.create` | ✓ | ✓ | ✓ | — |
| `profiles.read` | ✓ | ✓ | ✓ | ✓ |
| `roles.manage` | ✓ | — | — | — |
| `users.invite` | ✓ | — | — | — |
| `audit.read` | ✓ | ✓ | — | — |

Це лише реалізований перший етап, не майбутні дозволи робіт чи фінансів. Прав `sites.*`, `users.read` і `assets.inspect` немає.

## Серверні перевірки

- `requireSession()` перевіряє користувача через `auth.getUser()`, не довіряє `getSession()`. Не перевіряє активність: потрібний також для встановлення пароля запрошеному користувачу.
- `getAccessContext()` повертає `{ supabase, user, profile, roles: string[], permissions: PermissionCode[] }`, відхиляє відсутній/неактивний профіль та порожні ролі. `requirePageSession()` додає перенаправлення на `/login` або `/unauthorized`; його слід використовувати в захищеному layout.
- `requirePermission(code)` використовує JWT-клієнт і приймає лише булеве `true` від SQL. `requirePagePermission(code)` зберігає сигнатуру та перенаправляє тільки `AccessDeniedError`. Невідомі помилки Auth/БД не маскуються як 403.
- Перевірка layout — не заміна перевірки кожної Server Action/Route Handler. RLS є незалежним захистом.
- `src/proxy.ts` оновлює cookies через verified `getUser()` та встановлює `private, no-store`. Він не замінює бізнес-перевірок. Не кешувати приватні відповіді на CDN, reverse proxy чи service worker; не логувати callback query/token/cookies.

## Маршрути і листи

`/login`, `/recovery`, `/set-password`, `/auth/callback`, `/auth/error`, `/unauthorized`, `/settings`. Вихід — POST Server Action `logoutAction` (є `LogoutButton`), не GET. Публічної реєстрації немає; **вимкніть Allow new users to sign up у Supabase Auth**. Наявність лише закритого UI не вимикає публічний API реєстрації провайдера.

Встановіть `NEXT_PUBLIC_SITE_URL` у довірений HTTPS origin (наприклад `https://maintenance.example.org`), без шляху, query, fragment або credentials. HTTP дозволений тільки для `localhost`, `127.0.0.1`, `[::1]`. Додайте точний `<SITE_URL>/auth/callback` до Supabase Redirect URLs, налаштуйте Site URL, SMTP, ліміти листів і захист Auth від brute force. Жодні `Host`, `next`, `redirectTo` із запиту не визначають призначення redirect.

Для SSR рекомендовані шаблони листів із TokenHash (працюють також в іншому браузері):

- Invite user: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite">Прийняти запрошення</a>`.
- Reset password: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Встановити пароль</a>`.
- Підтвердження email OTP підтримує `type=email`; інші типи callback відхиляються.

Також підтримується `?code=...` через PKCE `exchangeCodeForSession`; для recovery потрібен той самий браузер із verifier cookie. Стандартний invite-шаблон, який повертає токени у URL fragment, **не підтримується** — налаштуйте TokenHash-шаблон вище. Після callback користувач встановлює пароль (12–128 символів із повторним підтвердженням); перед бізнес-доступом повторно перевіряються активність і ролі. Запрошення не підтверджує доставку листа до скриньки: перевіряйте SMTP.

## Адміністрування

`/settings` доступний за `roles.manage`. Запрошення додатково вимагає `users.invite` **до створення service client**. Service key використовується тільки для `auth.admin.inviteUserByEmail`; `set_user_roles(target_user_id, role_codes)` та `set_profile_active(target_user_id, active)` викликаються виключно з JWT поточного адміністратора. Порожній набір ролей дозволений і закриває доступ. БД атомарно захищає останнього активного адміністратора й веде аудит.

Запрошення Auth та призначення ролей не є спільною транзакцією. Якщо лист уже надісланий, а RPC не завершився, форма явно повідомляє про частковий успіх і показує UUID. Не надсилайте повторне запрошення: знайдіть профіль у списку та збережіть ролі окремо. За мережевого таймауту результат RPC може бути невідомим — спочатку перевірте поточний набір ролей. Невідомі технічні помилки інших операцій передаються до серверної обробки помилок, а не перетворюються на «немає прав».

Список обмежений першими 100 профілями (MVP на 2–5 людей). Електронні адреси не дублюються в публічній таблиці профілів; користувач ідентифікується ім’ям та UUID. Редагування email, повторне надсилання invitation, MFA та розширений пошук не входять до цього етапу.

## Перший адміністратор

1. Застосуйте foundation-міграцію. У Supabase Dashboard створіть або запросіть конкретного Auth-користувача; для запрошення спочатку налаштуйте лист. Нікому не передавайте спільний пароль.
2. Перевірте UUID користувача та проєкт. Задайте в захищеному середовищі `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BOOTSTRAP_ADMIN_USER_ID` (UUID наявного Auth-користувача з активним профілем). Ключ не має префікса `NEXT_PUBLIC_`, не комітиться та не передається браузеру.
3. Запустіть `node --env-file=.env.local scripts/bootstrap-admin.mjs` (Node з підтримкою `--env-file`) або `node scripts/bootstrap-admin.mjs`, якщо змінні вже експортовано. Скрипт не створює користувачів або паролів і не друкує ключі.
4. RPC `bootstrap_administrator(user_id)` доступний лише `service_role`, одноразовість забезпечується БД. Повторний запуск завершиться помилкою, а не перепризначить адміністратора. Надалі керуйте доступом тільки через `/settings`.
5. Адміністратор встановлює власний пароль через invitation/recovery та входить. Приберіть `BOOTSTRAP_ADMIN_USER_ID` із постійного середовища. Service key залишається серверним секретом для запрошень; за витоку його потрібно ротувати.

## Перевірки та межі

Вузькі unit-тести перевіряють fail-closed guards, технічні помилки, конфігурацію redirect, валідацію та межу service/JWT. Реальні SMTP, доставка листів, cookies у браузері й наскрізні invitation/recovery потребують налаштованого Supabase та окремого smoke-тесту; SDK mocks цього не доводять. Загальні lint/build/tests виконує інтегруючий агент після об’єднання робіт.
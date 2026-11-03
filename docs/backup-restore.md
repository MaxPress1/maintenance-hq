# Резервне копіювання та відновлення даних

## 1. Резервне копіювання бази даних PostgreSQL

### Щоденний автоматичний дамп (pg_dump)
Для створення повного знімка бази даних використовуйте утиліту `pg_dump`:

```bash
pg_dump --clean --if-exists --no-owner --no-privileges \
  -h <DB_HOST> -p 5432 -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Збереження історії та аудіту
Таблиця `public.audit_logs` автоматично фіксує всі зміни у форматі `jsonb` (старий та новий стан рядка). При створенні бекапу дані аудиту зберігаються автоматично.

## 2. Резервне копіювання файлів (Supabase Storage)

Вкладення та фотографії зберігаються у приватному бакеті `attachments`.
Для резервування об'єктів сховища використовуйте S3-сумісний клієнт (AWS CLI / MinIO Client):

```bash
aws --endpoint-url https://<PROJECT_ID>.supabase.co/storage/v1/s3 \
  s3 sync s3://attachments ./backup_storage_attachments/
```

## 3. Відновлення системи з резервної копії

1. Створіть нову порожню базу даних або очистіть існуючу.
2. Відновіть SQL схему та дані:
   ```bash
   psql -h <DB_HOST> -p 5432 -U postgres -d postgres < backup_YYYYMMDD_HHMMSS.sql
   ```
3. Відновіть файли у бакет `attachments`:
   ```bash
   aws --endpoint-url https://<PROJECT_ID>.supabase.co/storage/v1/s3 \
     s3 sync ./backup_storage_attachments/ s3://attachments
   ```
4. Перевірте працездатність додатку та доступ першого адміністратора.

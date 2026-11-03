begin;

-- Permissions for Reports
insert into public.permissions (code, description) values
  ('reports.read', 'Read analytical reports and export CSV summaries')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('administrator', 'reports.read'),
  ('coordinator', 'reports.read'),
  ('finance', 'reports.read')
on conflict (role_code, permission_code) do nothing;

-- Notifications Table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  message text not null check (length(btrim(message)) between 1 and 2000),
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

-- Triggers & Audit
create trigger notifications_audit after insert or update or delete on public.notifications
for each row execute function private.capture_audit();

-- Enable RLS
alter table public.notifications enable row level security;

-- Grants
grant select, insert, update, delete on public.notifications to authenticated;

-- Policies
create policy notifications_user_policy on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy notifications_update_policy on public.notifications for update to authenticated
using (user_id = auth.uid());

commit;

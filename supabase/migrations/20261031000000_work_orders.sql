begin;

-- Permissions
insert into public.permissions (code, description) values
  ('work_orders.read', 'Read work orders and tickets'),
  ('work_orders.manage', 'Create, triage, assign, and manage all work orders'),
  ('work_orders.execute', 'Update assigned work orders and report completion')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('administrator', 'work_orders.read'),
  ('administrator', 'work_orders.manage'),
  ('administrator', 'work_orders.execute'),
  ('coordinator', 'work_orders.read'),
  ('coordinator', 'work_orders.manage'),
  ('worker', 'work_orders.read'),
  ('worker', 'work_orders.execute'),
  ('finance', 'work_orders.read')
on conflict (role_code, permission_code) do nothing;

-- Work Orders Table
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '',
  asset_id uuid not null references public.assets(id) on delete restrict,
  work_type text not null default 'unplanned' check (work_type in ('planned', 'emergency', 'unplanned', 'preventive', 'damage_recovery', 'improvement')),
  reported_urgency text default 'medium' check (reported_urgency in ('critical', 'high', 'medium', 'low', 'unknown')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'new' check (status in ('new', 'estimating', 'pending_approval', 'scheduled', 'in_progress', 'waiting_materials', 'waiting_contractor', 'review', 'completed', 'canceled')),
  author_id uuid references public.profiles(id) on delete set null,
  source text not null default 'internal' check (source in ('internal', 'public')),
  responsible_id uuid references public.profiles(id) on delete restrict,
  planned_start_date date,
  planned_end_date date,
  deadline timestamptz,
  actual_start_date timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  completion_result text not null default '',
  planned_cost numeric(18,2) not null default 0 check (planned_cost >= 0),
  approved_budget numeric(18,2) not null default 0 check (approved_budget >= 0),
  actual_cost numeric(18,2) not null default 0 check (actual_cost >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date),
  check (
    status not in ('scheduled', 'in_progress', 'waiting_materials', 'waiting_contractor', 'review', 'completed')
    or responsible_id is not null
  ),
  check (
    status <> 'completed'
    or (completed_at is not null and completed_by is not null and length(btrim(completion_result)) > 0)
  )
);

create index work_orders_asset_idx on public.work_orders(asset_id);
create index work_orders_status_idx on public.work_orders(status);
create index work_orders_priority_idx on public.work_orders(priority);
create index work_orders_responsible_idx on public.work_orders(responsible_id);
create index work_orders_author_idx on public.work_orders(author_id);
create index work_orders_dates_idx on public.work_orders(planned_start_date, planned_end_date);
create index work_orders_deadline_idx on public.work_orders(deadline) where status not in ('completed', 'canceled');

-- Work Order Assignments
create table public.work_order_assignments (
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  primary key (work_order_id, user_id)
);

create index work_order_assignments_user_idx on public.work_order_assignments(user_id);

-- Work Order Comments
create table public.work_order_comments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  content text not null check (length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index work_order_comments_order_idx on public.work_order_comments(work_order_id, created_at asc);

-- Attachments Table
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('asset', 'work_order', 'finance')),
  record_id uuid not null,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  file_name text not null check (length(btrim(file_name)) > 0),
  file_size bigint not null check (file_size > 0),
  mime_type text not null check (length(btrim(mime_type)) > 0),
  phase text not null default 'general' check (phase in ('before', 'during', 'after', 'general')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index attachments_record_idx on public.attachments(record_type, record_id);

-- Public Report Tokens
create table public.public_report_tokens (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index public_report_tokens_asset_idx on public.public_report_tokens(asset_id);

-- Audit triggers & Updated_at
create trigger work_orders_touch before update on public.work_orders
for each row execute function private.touch_row();

create trigger work_orders_audit after insert or update or delete on public.work_orders
for each row execute function private.capture_audit();

create trigger work_order_assignments_audit after insert or update or delete on public.work_order_assignments
for each row execute function private.capture_audit();

create trigger work_order_comments_audit after insert or update or delete on public.work_order_comments
for each row execute function private.capture_audit();

create trigger attachments_audit after insert or update or delete on public.attachments
for each row execute function private.capture_audit();

create trigger public_report_tokens_audit after insert or update or delete on public.public_report_tokens
for each row execute function private.capture_audit();

-- Enable RLS
alter table public.work_orders enable row level security;
alter table public.work_order_assignments enable row level security;
alter table public.work_order_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.public_report_tokens enable row level security;

-- Grants
grant select, insert, update on public.work_orders to authenticated;
grant select, insert, update, delete on public.work_order_assignments to authenticated;
grant select, insert on public.work_order_comments to authenticated;
grant select, insert, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.public_report_tokens to authenticated;

-- RLS Policies
create policy work_orders_read on public.work_orders for select to authenticated
using (
  public.has_permission('work_orders.read')
);

create policy work_orders_insert on public.work_orders for insert to authenticated
with check (
  public.has_permission('work_orders.manage') or (
    public.has_permission('work_orders.read') and source = 'internal'
  )
);

create policy work_orders_update on public.work_orders for update to authenticated
using (
  public.has_permission('work_orders.manage') or (
    public.has_permission('work_orders.execute') and (
      responsible_id = auth.uid() or exists (
        select 1 from public.work_order_assignments
        where work_order_id = id and user_id = auth.uid()
      )
    )
  )
);

create policy assignments_read on public.work_order_assignments for select to authenticated
using (
  public.has_permission('work_orders.read')
);

create policy assignments_manage on public.work_order_assignments for all to authenticated
using (
  public.has_permission('work_orders.manage')
);

create policy comments_read on public.work_order_comments for select to authenticated
using (
  public.has_permission('work_orders.read')
);

create policy comments_insert on public.work_order_comments for insert to authenticated
with check (
  public.has_permission('work_orders.read') and author_id = auth.uid()
);

create policy attachments_read on public.attachments for select to authenticated
using (
  public.has_permission('work_orders.read') or public.has_permission('assets.read')
);

create policy attachments_insert on public.attachments for insert to authenticated
with check (
  public.has_permission('work_orders.read')
);

create policy public_tokens_manage on public.public_report_tokens for all to authenticated
using (
  public.has_permission('assets.manage') or public.has_permission('work_orders.manage')
);

commit;

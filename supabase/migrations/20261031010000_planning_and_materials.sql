begin;

-- Permissions for Planning & Materials
insert into public.permissions (code, description) values
  ('planning.read', 'Read planning calendar and annual schedule'),
  ('planning.manage', 'Manage annual plan, reschedule orders and edit dependencies'),
  ('materials.read', 'Read material catalog and stock levels'),
  ('materials.manage', 'Manage material catalog, stock adjustments and requirements')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('administrator', 'planning.read'),
  ('administrator', 'planning.manage'),
  ('administrator', 'materials.read'),
  ('administrator', 'materials.manage'),
  ('coordinator', 'planning.read'),
  ('coordinator', 'planning.manage'),
  ('coordinator', 'materials.read'),
  ('coordinator', 'materials.manage'),
  ('worker', 'planning.read'),
  ('worker', 'materials.read'),
  ('finance', 'planning.read'),
  ('finance', 'materials.read')
on conflict (role_code, permission_code) do nothing;

-- Work Order Dependencies
create table public.work_order_dependencies (
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  depends_on_work_order_id uuid not null references public.work_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_order_id, depends_on_work_order_id),
  check (work_order_id <> depends_on_work_order_id)
);

create index work_order_deps_depends_idx on public.work_order_dependencies(depends_on_work_order_id);

-- Work Order Reschedules (History of date changes with reason)
create table public.work_order_reschedules (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  old_start_date date,
  old_end_date date,
  new_start_date date,
  new_end_date date,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  rescheduled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index work_order_reschedules_wo_idx on public.work_order_reschedules(work_order_id, created_at desc);

-- Materials Directory
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  category text not null default 'Загальне' check (length(btrim(category)) between 1 and 100),
  unit text not null default 'шт' check (length(btrim(unit)) between 1 and 20),
  estimated_price numeric(18,2) not null default 0 check (estimated_price >= 0),
  stock_quantity numeric(18,3) not null default 0 check (stock_quantity >= 0),
  min_stock_level numeric(18,3) not null default 0 check (min_stock_level >= 0),
  supplier text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index materials_category_idx on public.materials(category);
create index materials_stock_idx on public.materials(stock_quantity, min_stock_level);

-- Material Requests (Needs for specific work orders)
create table public.material_requests (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  requested_quantity numeric(18,3) not null check (requested_quantity > 0),
  created_at timestamptz not null default now()
);

create index material_requests_wo_idx on public.material_requests(work_order_id);

-- Material Usages (Recorded actual consumption by workers)
create table public.material_usages (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  used_quantity numeric(18,3) not null check (used_quantity > 0),
  used_at timestamptz not null default now(),
  used_by uuid references public.profiles(id) on delete set null
);

create index material_usages_wo_idx on public.material_usages(work_order_id);

-- Material Stock Adjustments (Manual audits / arrivals / corrections with reasons)
create table public.material_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  delta numeric(18,3) not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  adjusted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index material_adj_mat_idx on public.material_stock_adjustments(material_id);

-- Triggers
create trigger materials_touch before update on public.materials
for each row execute function private.touch_row();

create trigger materials_audit after insert or update or delete on public.materials
for each row execute function private.capture_audit();

create trigger work_order_dependencies_audit after insert or update or delete on public.work_order_dependencies
for each row execute function private.capture_audit();

create trigger work_order_reschedules_audit after insert or update or delete on public.work_order_reschedules
for each row execute function private.capture_audit();

create trigger material_requests_audit after insert or update or delete on public.material_requests
for each row execute function private.capture_audit();

create trigger material_usages_audit after insert or update or delete on public.material_usages
for each row execute function private.capture_audit();

create trigger material_stock_adjustments_audit after insert or update or delete on public.material_stock_adjustments
for each row execute function private.capture_audit();

-- Enable RLS
alter table public.work_order_dependencies enable row level security;
alter table public.work_order_reschedules enable row level security;
alter table public.materials enable row level security;
alter table public.material_requests enable row level security;
alter table public.material_usages enable row level security;
alter table public.material_stock_adjustments enable row level security;

-- Grants
grant select, insert, update, delete on public.work_order_dependencies to authenticated;
grant select, insert on public.work_order_reschedules to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.material_requests to authenticated;
grant select, insert on public.material_usages to authenticated;
grant select, insert on public.material_stock_adjustments to authenticated;

-- Policies
create policy dependencies_read on public.work_order_dependencies for select to authenticated
using (public.has_permission('planning.read') or public.has_permission('work_orders.read'));

create policy dependencies_manage on public.work_order_dependencies for all to authenticated
using (public.has_permission('planning.manage') or public.has_permission('work_orders.manage'));

create policy reschedules_read on public.work_order_reschedules for select to authenticated
using (public.has_permission('planning.read') or public.has_permission('work_orders.read'));

create policy reschedules_insert on public.work_order_reschedules for insert to authenticated
with check (public.has_permission('planning.manage') or public.has_permission('work_orders.manage'));

create policy materials_read on public.materials for select to authenticated
using (public.has_permission('materials.read'));

create policy materials_manage on public.materials for all to authenticated
using (public.has_permission('materials.manage'));

create policy requests_read on public.material_requests for select to authenticated
using (public.has_permission('materials.read') or public.has_permission('work_orders.read'));

create policy requests_manage on public.material_requests for all to authenticated
using (public.has_permission('materials.manage') or public.has_permission('work_orders.manage'));

create policy usages_read on public.material_usages for select to authenticated
using (public.has_permission('materials.read') or public.has_permission('work_orders.read'));

create policy usages_insert on public.material_usages for insert to authenticated
with check (public.has_permission('work_orders.execute') or public.has_permission('materials.manage'));

create policy adjustments_read on public.material_stock_adjustments for select to authenticated
using (public.has_permission('materials.read'));

create policy adjustments_insert on public.material_stock_adjustments for insert to authenticated
with check (public.has_permission('materials.manage'));

commit;

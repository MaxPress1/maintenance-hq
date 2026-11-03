begin;

-- Permissions
insert into public.permissions (code, description) values
  ('finance.read', 'Read budgets, financial entries, and expense reports'),
  ('finance.manage', 'Manage annual budgets, allocations, financial transactions, and storno operations')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code) values
  ('administrator', 'finance.read'),
  ('administrator', 'finance.manage'),
  ('coordinator', 'finance.read'),
  ('finance', 'finance.read'),
  ('finance', 'finance.manage')
on conflict (role_code, permission_code) do nothing;

-- Annual Budgets Table
create table public.annual_budgets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  year integer not null check (year between 2020 and 2100),
  planned_amount numeric(18,2) not null check (planned_amount >= 0),
  reserve_amount numeric(18,2) not null default 0 check (reserve_amount >= 0 and reserve_amount <= planned_amount),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index annual_budgets_site_year_idx on public.annual_budgets (coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), year);

-- Work Order Allocations (Approved funds allocated to specific work order)
create table public.work_order_allocations (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  budget_year integer not null check (budget_year between 2020 and 2100),
  approved_amount numeric(18,2) not null check (approved_amount >= 0),
  created_at timestamptz not null default now()
);

create index work_order_alloc_wo_idx on public.work_order_allocations(work_order_id);
create index work_order_alloc_year_idx on public.work_order_allocations(budget_year);

-- Budget Transactions
create table public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  category text not null check (category in ('materials', 'labor', 'delivery', 'equipment_rental', 'contractors', 'other')),
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null default 'UAH' check (length(currency) = 3),
  exchange_rate_to_uah numeric(18,8) not null default 1.0 check (exchange_rate_to_uah > 0),
  amount_uah numeric(18,2) not null check (amount_uah <> 0),
  description text not null check (length(btrim(description)) between 1 and 2000),
  is_storno boolean not null default false,
  storno_for_id uuid references public.budget_transactions(id) on delete restrict,
  status text not null default 'posted' check (status in ('draft', 'approved', 'posted')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index budget_tx_wo_idx on public.budget_transactions(work_order_id);
create index budget_tx_category_idx on public.budget_transactions(category);
create index budget_tx_date_idx on public.budget_transactions(created_at desc);

-- Function to recalculate work order actual_cost and approved_budget
create or replace function private.recalc_work_order_finances() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_wo_id uuid := coalesce(NEW.work_order_id, OLD.work_order_id);
  total_fact numeric(18,2) := 0;
  total_alloc numeric(18,2) := 0;
begin
  if target_wo_id is not null then
    select coalesce(sum(amount_uah), 0) into total_fact
    from public.budget_transactions
    where work_order_id = target_wo_id and status = 'posted';

    select coalesce(sum(approved_amount), 0) into total_alloc
    from public.work_order_allocations
    where work_order_id = target_wo_id;

    update public.work_orders
    set actual_cost = total_fact,
        approved_budget = total_alloc
    where id = target_wo_id;
  end if;
  return null;
end;
$$;

create trigger budget_transactions_recalc after insert or update or delete on public.budget_transactions
for each row execute function private.recalc_work_order_finances();

create trigger work_order_allocations_recalc after insert or update or delete on public.work_order_allocations
for each row execute function private.recalc_work_order_finances();

-- Touch & Audit triggers
create trigger annual_budgets_touch before update on public.annual_budgets
for each row execute function private.touch_row();

create trigger annual_budgets_audit after insert or update or delete on public.annual_budgets
for each row execute function private.capture_audit();

create trigger work_order_allocations_audit after insert or update or delete on public.work_order_allocations
for each row execute function private.capture_audit();

create trigger budget_transactions_audit after insert or update or delete on public.budget_transactions
for each row execute function private.capture_audit();

-- Enable RLS
alter table public.annual_budgets enable row level security;
alter table public.work_order_allocations enable row level security;
alter table public.budget_transactions enable row level security;

-- Grants
grant select, insert, update, delete on public.annual_budgets to authenticated;
grant select, insert, update, delete on public.work_order_allocations to authenticated;
grant select, insert, update, delete on public.budget_transactions to authenticated;

-- Policies
create policy annual_budgets_read on public.annual_budgets for select to authenticated
using (public.has_permission('finance.read'));

create policy annual_budgets_manage on public.annual_budgets for all to authenticated
using (public.has_permission('finance.manage'));

create policy allocations_read on public.work_order_allocations for select to authenticated
using (public.has_permission('finance.read') or public.has_permission('work_orders.read'));

create policy allocations_manage on public.work_order_allocations for all to authenticated
using (public.has_permission('finance.manage'));

create policy transactions_read on public.budget_transactions for select to authenticated
using (public.has_permission('finance.read') or (
  public.has_permission('work_orders.read') and exists (
    select 1 from public.work_orders where id = budget_transactions.work_order_id
  )
));

create policy transactions_manage on public.budget_transactions for all to authenticated
using (public.has_permission('finance.manage'));

commit;

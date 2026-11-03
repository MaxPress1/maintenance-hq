begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create table private.mutex (
  name text primary key,
  version bigint not null default 0
);
insert into private.mutex(name) values ('hierarchy'), ('administration');
create table private.bootstrap_state (
  singleton boolean primary key default true check (singleton),
  completed_at timestamptz not null default now(),
  user_id uuid not null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default '' check (length(display_name) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.roles (
  code text primary key,
  name text not null
);
create table public.permissions (
  code text primary key,
  description text not null
);
create table public.role_permissions (
  role_code text not null references public.roles(code),
  permission_code text not null references public.permissions(code),
  primary key (role_code, permission_code)
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete restrict,
  role_code text not null references public.roles(code),
  created_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  type text not null check (length(btrim(type)) between 1 and 100),
  site_id uuid not null references public.sites(id) on delete restrict,
  parent_id uuid references public.assets(id) on delete restrict,
  location_description text not null default '',
  condition text not null default 'unknown' check (condition in ('unknown', 'good', 'fair', 'poor', 'critical')),
  responsible_id uuid references public.profiles(id) on delete restrict,
  last_inspected_at timestamptz,
  next_inspection_at timestamptz,
  description text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id),
  check (next_inspection_at is null or last_inspected_at is null or next_inspection_at >= last_inspected_at)
);
create index assets_site_parent_idx on public.assets(site_id, parent_id);
create index assets_parent_idx on public.assets(parent_id);
create index assets_responsible_idx on public.assets(responsible_id);
create index assets_next_inspection_idx on public.assets(next_inspection_at) where archived_at is null;
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  inspected_by uuid not null references public.profiles(id) on delete restrict,
  inspected_at timestamptz not null default now(),
  condition text not null check (condition in ('unknown', 'good', 'fair', 'poor', 'critical')),
  next_inspection_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (next_inspection_at is null or next_inspection_at >= inspected_at)
);
create index inspections_asset_date_idx on public.inspections(asset_id, inspected_at desc);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index audit_logs_record_idx on public.audit_logs(table_name, record_id, created_at);

insert into public.roles values
  ('administrator', 'Адміністратор'), ('coordinator', 'Координатор'),
  ('worker', 'Виконавець'), ('finance', 'Фінансовий відповідальний');
insert into public.permissions values
  ('assets.read', 'Read asset and site context'), ('assets.manage', 'Manage sites and assets'),
  ('inspections.read', 'Read inspection history'), ('inspections.create', 'Record inspections'),
  ('profiles.read', 'Read staff directory'), ('roles.manage', 'Manage user roles and active state'),
  ('users.invite', 'Authorize server-side Auth invitations'), ('audit.read', 'Read audit snapshots');
insert into public.role_permissions
select 'administrator', code from public.permissions;
insert into public.role_permissions values
  ('coordinator', 'assets.read'), ('coordinator', 'assets.manage'),
  ('coordinator', 'inspections.read'), ('coordinator', 'inspections.create'),
  ('coordinator', 'profiles.read'), ('coordinator', 'audit.read'),
  ('worker', 'assets.read'), ('worker', 'inspections.read'), ('worker', 'inspections.create'),
  ('worker', 'profiles.read'), ('finance', 'assets.read'), ('finance', 'profiles.read'),
  ('finance', 'inspections.read');

create function public.has_permission(permission_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_code = ur.role_code
    where p.id = auth.uid() and p.is_active and rp.permission_code = $1
  );
$$;

create function private.capture_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb;
begin
  if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
  insert into public.audit_logs(table_name, record_id, operation, actor_id, old_data, new_data)
  values (TG_TABLE_NAME, coalesce((after_row->>'id')::uuid, (before_row->>'id')::uuid,
    (after_row->>'user_id')::uuid, (before_row->>'user_id')::uuid),
    TG_OP, auth.uid(), before_row, after_row);
  return null;
end;
$$;
create function private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'History is immutable; deletion is not supported' using errcode = '23514';
end;
$$;
create function private.touch_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'Identity and creation time are immutable' using errcode = '23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create function private.lock_hierarchy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.mutex set version = version + 1 where name = 'hierarchy';
  return null;
end;
$$;
create function private.validate_site() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and old.archived_at is not null and new.archived_at is not null then
    raise exception 'Restore archived site before editing' using errcode = '23514';
  end if;
  if new.archived_at is not null and exists (
    select 1 from public.assets where site_id = new.id and archived_at is null
  ) then
    raise exception 'Archive active site assets first' using errcode = '23514';
  end if;
  return new;
end;
$$;
create function private.validate_asset() returns trigger
language plpgsql security definer set search_path = '' as $$
declare parent_row public.assets;
begin
  if TG_OP = 'UPDATE' and old.archived_at is not null and new.archived_at is not null then
    raise exception 'Restore archived asset before editing' using errcode = '23514';
  end if;
  if new.archived_at is null and not exists (
    select 1 from public.sites where id = new.site_id and archived_at is null
  ) then
    raise exception 'Active asset requires active site' using errcode = '23514';
  end if;
  if new.responsible_id is not null and not exists (
    select 1 from public.profiles where id = new.responsible_id and is_active
  ) then
    raise exception 'Responsible profile must be active' using errcode = '23514';
  end if;
  if new.parent_id is not null then
    select * into parent_row from public.assets where id = new.parent_id;
    if not found or parent_row.site_id <> new.site_id then
      raise exception 'Parent must exist in the same site' using errcode = '23514';
    end if;
    if new.archived_at is null and parent_row.archived_at is not null then
      raise exception 'Active asset requires active parent' using errcode = '23514';
    end if;
    if exists (
      with recursive ancestors as (
        select id, parent_id from public.assets where id = new.parent_id
        union
        select a.id, a.parent_id from public.assets a join ancestors b on a.id = b.parent_id
      ) select 1 from ancestors where id = new.id
    ) then
      raise exception 'Asset hierarchy cycle' using errcode = '23514';
    end if;
  end if;
  if exists (select 1 from public.assets where parent_id = new.id and site_id <> new.site_id) then
    raise exception 'Move children before changing parent site' using errcode = '23514';
  end if;
  if new.archived_at is not null and exists (
    select 1 from public.assets where parent_id = new.id and archived_at is null
  ) then
    raise exception 'Archive active children first' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.apply_inspection() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.assets;
begin
  if not public.has_permission('inspections.create') then
    raise exception 'Inspection permission required' using errcode = '42501';
  end if;
  select * into target from public.assets where id = new.asset_id for update;
  if not found or target.archived_at is not null then
    raise exception 'Inspection requires active asset' using errcode = '23514';
  end if;
  if new.inspected_at > clock_timestamp() or
     (target.last_inspected_at is not null and new.inspected_at <= target.last_inspected_at) then
    raise exception 'Inspection must be newer than last inspection and not in future' using errcode = '23514';
  end if;
  new.inspected_by := auth.uid();
  new.created_at := clock_timestamp();
  update public.assets set condition = new.condition, last_inspected_at = new.inspected_at,
    next_inspection_at = new.next_inspection_at where id = new.asset_id;
  return new;
end;
$$;

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 200));
  return new;
end;
$$;
create trigger auth_user_profile after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 200) from auth.users
on conflict (id) do nothing;

create function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.bootstrap_state) and not exists (
    select 1 from public.profiles p join public.user_roles ur on ur.user_id = p.id
    where p.is_active and ur.role_code = 'administrator'
  ) then
    raise exception 'Cannot remove or deactivate last active administrator' using errcode = '23514';
  end if;
  return null;
end;
$$;
create function private.lock_administration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.mutex set version = version + 1 where name = 'administration';
  return null;
end;
$$;

create function public.bootstrap_administrator(user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- EXECUTE is granted exclusively to service_role (and the database owner).
  perform pg_advisory_xact_lock(918273645::bigint);
  update private.mutex set version = version + 1 where name = 'administration';
  if exists (select 1 from private.bootstrap_state) then
    raise exception 'Administrator bootstrap already completed' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = $1 and is_active) then
    raise exception 'Bootstrap requires an existing active profile' using errcode = '23514';
  end if;
  insert into public.user_roles(user_id, role_code) values ($1, 'administrator')
  on conflict do nothing;
  insert into private.bootstrap_state(user_id) values ($1);
end;
$$;
create function public.set_user_roles(target_user_id uuid, role_codes text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.mutex set version = version + 1 where name = 'administration';
  if not public.has_permission('roles.manage') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  if role_codes is null or exists (
    select 1 from unnest(role_codes) r(code)
    where code is null or not exists (select 1 from public.roles where roles.code = r.code)
  ) then
    raise exception 'Invalid role codes' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Profile not found' using errcode = '22023';
  end if;
  -- Insert before deleting: retaining administrator never creates a transient zero-admin state.
  insert into public.user_roles(user_id, role_code)
  select target_user_id, code from unnest(role_codes) r(code) on conflict do nothing;
  delete from public.user_roles where user_id = target_user_id and not (role_code = any(role_codes));
end;
$$;
create function public.set_profile_active(target_user_id uuid, active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.mutex set version = version + 1 where name = 'administration';
  if not public.has_permission('roles.manage') then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;
  if active is null then raise exception 'Active state required' using errcode = '22023'; end if;
  update public.profiles set is_active = active where id = target_user_id;
  if not found then raise exception 'Profile not found' using errcode = '22023'; end if;
end;
$$;

create trigger profiles_lock before insert or update or delete on public.profiles
for each statement execute function private.lock_administration();
create trigger user_roles_lock before insert or update or delete on public.user_roles
for each statement execute function private.lock_administration();
create trigger profiles_admin_guard after update or delete on public.profiles
for each statement execute function private.guard_last_admin();
create trigger user_roles_admin_guard after update or delete on public.user_roles
for each statement execute function private.guard_last_admin();
create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_row();
create trigger sites_lock before insert or update or delete on public.sites
for each statement execute function private.lock_hierarchy();
create trigger assets_lock before insert or update or delete on public.assets
for each statement execute function private.lock_hierarchy();
create trigger inspections_lock before insert on public.inspections
for each statement execute function private.lock_hierarchy();
create trigger sites_touch before update on public.sites
for each row execute function private.touch_row();
create trigger assets_touch before update on public.assets
for each row execute function private.touch_row();
create trigger sites_validate before insert or update on public.sites
for each row execute function private.validate_site();
create trigger assets_validate before insert or update on public.assets
for each row execute function private.validate_asset();
create trigger inspections_apply before insert on public.inspections
for each row execute function private.apply_inspection();
create trigger inspections_immutable before update or delete or truncate on public.inspections
for each statement execute function private.reject_mutation();
create trigger audit_immutable before update or delete or truncate on public.audit_logs
for each statement execute function private.reject_mutation();
create trigger assets_no_delete before delete or truncate on public.assets
for each statement execute function private.reject_mutation();
create trigger sites_no_delete before delete or truncate on public.sites
for each statement execute function private.reject_mutation();

create trigger profiles_audit after insert or update or delete on public.profiles
for each row execute function private.capture_audit();
create trigger user_roles_audit after insert or update or delete on public.user_roles
for each row execute function private.capture_audit();
create trigger sites_audit after insert or update or delete on public.sites
for each row execute function private.capture_audit();
create trigger assets_audit after insert or update or delete on public.assets
for each row execute function private.capture_audit();
create trigger inspections_audit after insert on public.inspections
for each row execute function private.capture_audit();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.sites enable row level security;
alter table public.assets enable row level security;
alter table public.inspections enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (public.has_permission('profiles.read') or (id = auth.uid() and is_active));
create policy roles_read on public.roles for select to authenticated using (public.has_permission('profiles.read'));
create policy permissions_read on public.permissions for select to authenticated using (public.has_permission('profiles.read'));
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.has_permission('profiles.read'));
create policy user_roles_read on public.user_roles for select to authenticated
using (public.has_permission('roles.manage') or (user_id = auth.uid() and public.has_permission('profiles.read')));
create policy sites_read on public.sites for select to authenticated using (public.has_permission('assets.read'));
create policy assets_read on public.assets for select to authenticated using (public.has_permission('assets.read'));
create policy sites_insert on public.sites for insert to authenticated with check (public.has_permission('assets.manage'));
create policy sites_update on public.sites for update to authenticated
using (public.has_permission('assets.manage')) with check (public.has_permission('assets.manage'));
create policy assets_insert on public.assets for insert to authenticated with check (public.has_permission('assets.manage'));
create policy assets_update on public.assets for update to authenticated
using (public.has_permission('assets.manage')) with check (public.has_permission('assets.manage'));
create policy inspections_read on public.inspections for select to authenticated using (public.has_permission('inspections.read'));
create policy inspections_insert on public.inspections for insert to authenticated
with check (public.has_permission('inspections.create') and inspected_by = auth.uid());
create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission('audit.read'));

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;
revoke execute on function public.has_permission(text), public.bootstrap_administrator(uuid),
  public.set_user_roles(uuid, text[]), public.set_profile_active(uuid, boolean) from public, anon, authenticated, service_role;
grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.roles, public.permissions, public.role_permissions,
  public.user_roles, public.sites, public.assets, public.inspections, public.audit_logs to authenticated;
grant insert (name, description, archived_at) on public.sites to authenticated;
grant update (name, description, archived_at) on public.sites to authenticated;
grant insert (name, type, site_id, parent_id, location_description, condition, responsible_id,
  next_inspection_at, description, archived_at) on public.assets to authenticated;
grant update (name, type, site_id, parent_id, location_description, condition, responsible_id,
  next_inspection_at, description, archived_at) on public.assets to authenticated;
grant insert (asset_id, inspected_at, condition, next_inspection_at, notes) on public.inspections to authenticated;
grant execute on function public.has_permission(text), public.set_user_roles(uuid, text[]),
  public.set_profile_active(uuid, boolean) to authenticated;
grant execute on function public.bootstrap_administrator(uuid) to service_role;

commit;

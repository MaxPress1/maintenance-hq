begin;

create table private.foundation_requests (
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  kind text not null,
  payload jsonb not null,
  record_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);
revoke all on private.foundation_requests from public, anon, authenticated;

create function public.create_foundation_record(kind text, request_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous private.foundation_requests;
  result_id uuid;
begin
  if kind not in ('site', 'asset', 'inspection') or kind is null or request_id is null
    or payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  if actor is null or not public.has_permission(
    case when kind = 'inspection' then 'inspections.create' else 'assets.manage' end
  ) then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || request_id::text, 0));
  select * into previous from private.foundation_requests r
    where r.actor_id = actor and r.request_id = create_foundation_record.request_id;
  if found then
    if previous.kind <> kind or previous.payload <> payload then
      raise exception 'Request key already used for different input' using errcode = '22023';
    end if;
    return previous.record_id;
  end if;
  if kind = 'site' then
    insert into public.sites(name, description)
    values (payload->>'name', coalesce(payload->>'description', '')) returning id into result_id;
  elsif kind = 'asset' then
    insert into public.assets(name, type, site_id, parent_id, location_description, condition,
      responsible_id, next_inspection_at, description)
    values (payload->>'name', payload->>'type', (payload->>'site_id')::uuid,
      (payload->>'parent_id')::uuid, coalesce(payload->>'location_description', ''),
      payload->>'condition', (payload->>'responsible_id')::uuid,
      (payload->>'next_inspection_at')::timestamptz, coalesce(payload->>'description', ''))
    returning id into result_id;
  else
    insert into public.inspections(asset_id, condition, next_inspection_at, notes)
    values ((payload->>'asset_id')::uuid, payload->>'condition',
      (payload->>'next_inspection_at')::timestamptz, coalesce(payload->>'notes', ''))
    returning id into result_id;
  end if;
  insert into private.foundation_requests(actor_id, request_id, kind, payload, record_id)
  values (actor, request_id, kind, payload, result_id);
  return result_id;
end;
$$;
revoke execute on function public.create_foundation_record(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_foundation_record(text, uuid, jsonb) to authenticated;

commit;

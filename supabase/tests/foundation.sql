begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('30000000-0000-0000-0000-000000000001', 'admin@example.invalid', '{"display_name":"Test admin","role":"administrator"}'),
  ('30000000-0000-0000-0000-000000000002', 'coordinator@example.invalid', '{}'),
  ('30000000-0000-0000-0000-000000000003', 'worker@example.invalid', '{}'),
  ('30000000-0000-0000-0000-000000000004', 'finance@example.invalid', '{}'),
  ('30000000-0000-0000-0000-000000000005', 'none@example.invalid', '{"role":"administrator"}'),
  ('30000000-0000-0000-0000-000000000006', 'other-admin@example.invalid', '{}');
select is((select count(*) from profiles where id::text like '30000000-%'), 6::bigint, 'Auth trigger creates profiles');
select is((select count(*) from user_roles where user_id::text like '30000000-%'), 0::bigint, 'Metadata cannot grant roles');
select ok(not has_function_privilege('anon', 'public.has_permission(text)', 'EXECUTE'), 'anon cannot execute permission RPC');
select ok(not has_function_privilege('authenticated', 'public.bootstrap_administrator(uuid)', 'EXECUTE'), 'Users cannot bootstrap');
select ok(not has_function_privilege('authenticated', 'private.apply_inspection()', 'EXECUTE'), 'Trigger functions are private');
select ok(not has_table_privilege('authenticated', 'public.user_roles', 'INSERT'), 'No direct role writes');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'No forged audit');
select ok(not has_table_privilege('anon', 'public.assets', 'SELECT'), 'No anonymous asset reads');

set local role service_role;
select lives_ok($$select public.bootstrap_administrator('30000000-0000-0000-0000-000000000001')$$, 'Service bootstraps first administrator');
select throws_ok($$select public.bootstrap_administrator('30000000-0000-0000-0000-000000000006')$$, '23514', null, 'Bootstrap is one-time');
reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select ok(has_permission('roles.manage'), 'Admin manages roles');
select ok(has_permission('users.invite'), 'Admin authorizes invitations');
select lives_ok($$select set_user_roles('30000000-0000-0000-0000-000000000002', array['coordinator'])$$, 'Assign coordinator');
select lives_ok($$select set_user_roles('30000000-0000-0000-0000-000000000003', array['worker'])$$, 'Assign worker');
select lives_ok($$select set_user_roles('30000000-0000-0000-0000-000000000004', array['finance'])$$, 'Assign finance');
select throws_ok($$select set_user_roles('30000000-0000-0000-0000-000000000001', array[]::text[])$$, '23514', null, 'Cannot remove last administrator');
select throws_ok($$select set_profile_active('30000000-0000-0000-0000-000000000001', false)$$, '23514', null, 'Cannot deactivate last administrator');
select throws_ok($$select set_user_roles('30000000-0000-0000-0000-000000000002', array['invented'])$$, '22023', null, 'Unknown role rejected');
select lives_ok($$select set_user_roles('30000000-0000-0000-0000-000000000006', array['administrator','finance','finance'])$$, 'Multiple deduplicated roles');
select is((select count(*) from user_roles where user_id = '30000000-0000-0000-0000-000000000006'), 2::bigint, 'Multiple roles persist');
select lives_ok($$select set_profile_active('30000000-0000-0000-0000-000000000006', false)$$, 'Second administrator can deactivate');
select throws_ok($$select set_profile_active('30000000-0000-0000-0000-000000000001', false)$$, '23514', null, 'Inactive administrator does not satisfy guard');

reset role;
insert into sites(id, name) values
  ('40000000-0000-0000-0000-000000000001', 'Test A'),
  ('40000000-0000-0000-0000-000000000002', 'Test B');
insert into assets(id, name, type, site_id) values
  ('50000000-0000-0000-0000-000000000001', 'Parent', 'building', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', 'Other site', 'zone', '40000000-0000-0000-0000-000000000002');
insert into assets(id, name, type, site_id, parent_id) values
  ('50000000-0000-0000-0000-000000000002', 'Child', 'floor', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select ok(not has_permission('assets.read'), 'No-role user has no domain permission');
select is((select count(*) from assets), 0::bigint, 'No-role assets hidden');
select is((select count(*) from sites), 0::bigint, 'No-role sites hidden');
select is((select count(*) from audit_logs), 0::bigint, 'No-role audit hidden');
select throws_ok($$insert into sites(name) values ('Forbidden')$$, '42501', null, 'No-role insert rejected');
select throws_ok($$select set_user_roles('30000000-0000-0000-0000-000000000005', array['administrator'])$$, '42501', null, 'Cannot self-promote');
select throws_ok($$select bootstrap_administrator('30000000-0000-0000-0000-000000000005')$$, '42501', null, 'Bootstrap inaccessible from user JWT');

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
select ok(has_permission('assets.read') and not has_permission('assets.manage'), 'Finance read-only context');
select is((select count(*) from assets where id::text like '50000000-%'), 3::bigint, 'Finance reads context');
select throws_ok($$insert into assets(name,type,site_id) values ('Forbidden','zone','40000000-0000-0000-0000-000000000001')$$, '42501', null, 'Finance cannot create asset');
select throws_ok($$insert into inspections(asset_id,condition) values ('50000000-0000-0000-0000-000000000002','good')$$, '42501', null, 'Finance cannot inspect');
with changed as (update assets set name = 'Forbidden' where id = '50000000-0000-0000-0000-000000000002' returning id)
select is(count(*), 0::bigint, 'Finance cannot update asset') from changed;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select ok(has_permission('inspections.create') and not has_permission('assets.manage'), 'Worker inspection permission only');
select throws_ok($$insert into sites(name) values ('Forbidden')$$, '42501', null, 'Worker cannot manage sites');
select lives_ok($$insert into inspections(asset_id,condition,inspected_at,next_inspection_at,notes) values ('50000000-0000-0000-0000-000000000002','poor',now() - interval '1 hour',now() + interval '1 month','Test inspection')$$, 'Worker inspection bypasses only required asset update RLS');
select is((select condition from assets where id = '50000000-0000-0000-0000-000000000002'), 'poor', 'Inspection updates condition');
select is((select last_inspected_at from assets where id = '50000000-0000-0000-0000-000000000002'), now() - interval '1 hour', 'Inspection updates timestamp');
select is((select inspected_by from inspections where asset_id = '50000000-0000-0000-0000-000000000002'), '30000000-0000-0000-0000-000000000003'::uuid, 'Inspection actor derives from JWT');
select throws_ok($$insert into inspections(asset_id,condition,inspected_at) values ('50000000-0000-0000-0000-000000000002','good',now() - interval '2 hours')$$, '23514', null, 'Stale inspection rejected');
select throws_ok($$insert into inspections(asset_id,condition,inspected_at) values ('50000000-0000-0000-0000-000000000002','good',now() + interval '1 day')$$, '23514', null, 'Future inspection rejected');
select throws_ok($$insert into inspections(asset_id,condition,next_inspection_at) values ('50000000-0000-0000-0000-000000000002','good',now() - interval '1 day')$$, '23514', null, 'Failed inspection rolls back asset update');
select is((select condition from assets where id = '50000000-0000-0000-0000-000000000002'), 'poor', 'Asset unchanged after failed inspection');
select is((select count(*) from inspections where asset_id = '50000000-0000-0000-0000-000000000002'), 1::bigint, 'Only valid inspection persisted');
select throws_ok($$update inspections set notes = 'tampered'$$, '42501', null, 'Inspection history cannot be rewritten');
select is((select count(*) from audit_logs), 0::bigint, 'Worker cannot read audit');

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select ok(has_permission('assets.manage') and not has_permission('users.invite'), 'Coordinator manages assets but not invitations');
select lives_ok($$update assets set description = 'Updated by coordinator' where id = '50000000-0000-0000-0000-000000000001'$$, 'Coordinator asset update');
select throws_ok($$select set_user_roles('30000000-0000-0000-0000-000000000002', array['administrator'])$$, '42501', null, 'Coordinator cannot grant roles');
select throws_ok($$update assets set parent_id = id where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'Self-cycle rejected');
select throws_ok($$update assets set parent_id = '50000000-0000-0000-0000-000000000002' where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'Ancestor cycle rejected');
select throws_ok($$update assets set parent_id = '50000000-0000-0000-0000-000000000003' where id = '50000000-0000-0000-0000-000000000002'$$, '23514', null, 'Cross-site link rejected');
select throws_ok($$update assets set site_id = '40000000-0000-0000-0000-000000000002' where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'Moving parent cannot strand children across sites');
select throws_ok($$update assets set archived_at = now() where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'Archive children before parent');
select throws_ok($$update sites set archived_at = now() where id = '40000000-0000-0000-0000-000000000001'$$, '23514', null, 'Archive assets before site');
select lives_ok($$update assets set archived_at = now() where id = '50000000-0000-0000-0000-000000000002'$$, 'Archive leaf');
select throws_ok($$insert into inspections(asset_id,condition) values ('50000000-0000-0000-0000-000000000002','good')$$, '23514', null, 'Archived asset cannot be inspected');
select throws_ok($$update assets set name = 'Archived edit' where id = '50000000-0000-0000-0000-000000000002'$$, '23514', null, 'Archived asset is read-only');
select lives_ok($$update assets set archived_at = now() where id = '50000000-0000-0000-0000-000000000001'$$, 'Archive parent after child');
select throws_ok($$update assets set archived_at = null where id = '50000000-0000-0000-0000-000000000002'$$, '23514', null, 'Cannot restore child under archived parent');
select lives_ok($$update sites set archived_at = now() where id = '40000000-0000-0000-0000-000000000001'$$, 'Archive empty active site');
select throws_ok($$update assets set archived_at = null where id = '50000000-0000-0000-0000-000000000001'$$, '23514', null, 'Cannot restore under archived site');
select lives_ok($$update sites set archived_at = null where id = '40000000-0000-0000-0000-000000000001'$$, 'Restore site');
select lives_ok($$update assets set archived_at = null where id = '50000000-0000-0000-0000-000000000001'$$, 'Restore parent');
select lives_ok($$update assets set archived_at = null where id = '50000000-0000-0000-0000-000000000002'$$, 'Restore child');
select ok(exists (select 1 from audit_logs where table_name = 'assets' and record_id = '50000000-0000-0000-0000-000000000002' and old_data->>'condition' = 'unknown' and new_data->>'condition' = 'poor' and actor_id = '30000000-0000-0000-0000-000000000003'), 'Audit contains before/after inspection snapshot and actor');
select throws_ok($$update audit_logs set actor_id = null$$, '42501', null, 'Cannot alter audit');
select throws_ok($$delete from assets where id = '50000000-0000-0000-0000-000000000002'$$, '42501', null, 'Hard deletion denied');
select throws_ok($$update assets set last_inspected_at = now()$$, '42501', null, 'Inspection timestamp cannot be forged directly');

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000006', true);
select ok(not has_permission('roles.manage'), 'Inactive administrator has no permissions');
select is((select count(*) from assets), 0::bigint, 'Inactive administrator cannot read assets');
select throws_ok($$select set_profile_active('30000000-0000-0000-0000-000000000006', true)$$, '42501', null, 'Inactive administrator cannot reactivate self');
reset role;
select throws_ok($$update audit_logs set actor_id = null$$, '23514', null, 'Audit trigger also blocks owner updates');
select throws_ok($$truncate audit_logs$$, '23514', null, 'Audit truncate blocked');
select throws_ok($$update inspections set notes = 'tampered'$$, '23514', null, 'Inspection immutable even for owner');
select * from finish();
rollback;

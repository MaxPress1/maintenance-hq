begin;
insert into public.sites(id, name, description) values
  ('10000000-0000-0000-0000-000000000001', 'Демонстраційна територія', 'Синтетичні дані — не виробничий об’єкт'),
  ('10000000-0000-0000-0000-000000000002', 'Демонстраційний склад', 'Синтетичні дані')
on conflict (id) do nothing;
insert into public.assets(id, name, type, site_id, condition, description) values
  ('20000000-0000-0000-0000-000000000001', 'Навчальний корпус', 'building', '10000000-0000-0000-0000-000000000001', 'good', 'Демонстраційний об’єкт')
on conflict (id) do nothing;
insert into public.assets(id, name, type, site_id, parent_id, condition) values
  ('20000000-0000-0000-0000-000000000002', 'Перший поверх', 'floor', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'good')
on conflict (id) do nothing;
insert into public.assets(id, name, type, site_id, parent_id, location_description, condition) values
  ('20000000-0000-0000-0000-000000000003', 'Демонстраційний насос', 'equipment', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Технічна кімната', 'fair')
on conflict (id) do nothing;
commit;

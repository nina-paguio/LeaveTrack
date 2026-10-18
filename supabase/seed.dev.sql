-- DEV ONLY. Mock users for local and dev projects. Never run this against production.
-- Idempotent. Run after seed.sql (needs the leave_types rows).

-- Managers and HR first (no manager_id), then employees pointing at them.
insert into users (name, email, role, manager_id) values
  ('Hana Villanueva', 'hana@example.com',  'hr_admin', null),
  ('Maria Santos',    'maria@example.com', 'manager',  null),
  ('Paolo Reyes',     'paolo@example.com', 'manager',  null)
on conflict (email) do nothing;

insert into users (name, email, role, manager_id)
select v.name, v.email, 'employee'::user_role, m.id
from (values
  ('Ana Cruz',    'ana@example.com',   'maria@example.com'),
  ('Ben Lim',     'ben@example.com',   'maria@example.com'),
  ('Carla Dizon', 'carla@example.com', 'maria@example.com'),
  ('Dan Ocampo',  'dan@example.com',   'paolo@example.com'),
  ('Ella Tan',    'ella@example.com',  'paolo@example.com')
) as v (name, email, manager_email)
join users m on m.email = v.manager_email
on conflict (email) do nothing;

-- Policies: Vacation 1.25/month, Sick 0.5/month for everyone except HR.
insert into leave_policies (user_id, leave_type_id, accrual_per_month)
select u.id, t.id, case t.name when 'Vacation' then 1.25 else 0.5 end
from users u
join leave_types t on t.name in ('Vacation', 'Sick')
where u.role <> 'hr_admin'
on conflict (user_id, leave_type_id) do nothing;

insert into leave_balances (user_id, leave_type_id, balance)
select u.id, t.id, 0
from users u
join leave_types t on t.tracks_balance
where u.role <> 'hr_admin'
on conflict (user_id, leave_type_id) do nothing;

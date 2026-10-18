-- Reference data only. Idempotent and safe in every environment.
-- Mock users, policies and balances live in seed.dev.sql (dev only, never production).

insert into leave_types (name, tracks_balance) values
  ('Vacation', true),
  ('Sick', true),
  ('Unpaid', false)
on conflict (name) do nothing;

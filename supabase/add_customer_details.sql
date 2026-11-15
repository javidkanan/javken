begin;

alter table public.waitlist
  add column if not exists first_name varchar(80),
  add column if not exists last_name varchar(80),
  add column if not exists instagram varchar(30);

notify pgrst, 'reload schema';

commit;

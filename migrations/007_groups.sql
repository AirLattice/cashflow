create table if not exists groups (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists user_group_access (
  user_id bigint not null references users(id) on delete cascade,
  group_id bigint not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table users
  add column if not exists active_group_id bigint references groups(id);

insert into groups (name)
values ('family')
on conflict (name) do nothing;

update users
set active_group_id = (select id from groups where name = 'family')
where active_group_id is null;

insert into user_group_access (user_id, group_id)
select u.id, g.id
from users u
cross join (select id from groups where name = 'family') g
on conflict do nothing;

alter table fixed_expenses
  add column if not exists group_id bigint references groups(id);

alter table incomes
  add column if not exists group_id bigint references groups(id);

update fixed_expenses
set group_id = (select id from groups where name = 'family')
where group_id is null;

update incomes
set group_id = (select id from groups where name = 'family')
where group_id is null;

alter table fixed_expenses
  alter column group_id set not null;

alter table incomes
  alter column group_id set not null;

alter table users
  drop column if exists family_id;

alter table fixed_expenses
  drop column if exists family_id;

alter table incomes
  drop column if exists family_id;

drop table if exists families;

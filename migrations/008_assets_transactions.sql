alter table user_permissions
  drop column if exists can_view_fixed_expenses,
  drop column if exists can_view_incomes,
  add column if not exists can_view_assets boolean not null default false,
  add column if not exists can_view_transactions boolean not null default false;

drop table if exists fixed_expenses;
drop table if exists incomes;

create table if not exists assets (
  id bigserial primary key,
  group_id bigint not null references groups(id),
  name text not null,
  issuer text not null,
  asset_number text,
  asset_type text not null,
  current_balance_cents integer not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create unique index if not exists assets_group_asset_number_key
  on assets (group_id, asset_number)
  where asset_number is not null;

create table if not exists transactions (
  id bigserial primary key,
  group_id bigint not null references groups(id),
  asset_id bigint not null references assets(id),
  user_id bigint not null references users(id),
  direction text not null,
  amount_cents integer not null,
  principal_cents integer,
  installment_count integer,
  interest_rate numeric,
  memo text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

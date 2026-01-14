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

create table if not exists users (
  id bigserial primary key,
  username text not null unique,
  role text not null default 'user',
  password_hash text not null,
  active_group_id bigint references groups(id),
  created_at timestamptz not null default now()
);

create table if not exists refresh_tokens (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_permissions (
  user_id bigint primary key references users(id) on delete cascade,
  can_view_fixed_expenses boolean not null default false,
  can_view_incomes boolean not null default false,
  can_view_summary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id integer primary key,
  month_start_day integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists fixed_expenses (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  group_id bigint not null references groups(id),
  name text not null,
  total_amount_cents integer not null,
  per_month_cents integer not null,
  start_date date not null,
  end_date date not null,
  payment_type text not null default 'single',
  installments_count integer,
  interest_rate numeric,
  total_interest_cents integer,
  total_with_interest_cents integer,
  remaining_cents integer,
  created_at timestamptz not null default now()
);

create table if not exists incomes (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  group_id bigint not null references groups(id),
  name text not null,
  amount_cents integer not null,
  income_date date not null,
  created_at timestamptz not null default now()
);

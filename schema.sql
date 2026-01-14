create table if not exists users (
  id bigserial primary key,
  username text not null unique,
  role text not null default 'user',
  password_hash text not null,
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

create table if not exists fixed_expenses (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  name text not null,
  total_amount_cents integer not null,
  per_month_cents integer not null,
  start_date date not null,
  end_date date not null,
  payment_type text not null default 'single',
  installments_count integer,
  created_at timestamptz not null default now()
);

create table if not exists incomes (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  name text not null,
  amount_cents integer not null,
  income_date date not null,
  created_at timestamptz not null default now()
);

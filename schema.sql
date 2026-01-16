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
  can_view_assets boolean not null default false,
  can_view_transactions boolean not null default false,
  can_view_summary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists group_settings (
  group_id bigint primary key references groups(id) on delete cascade,
  month_start_day integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id bigserial primary key,
  group_id bigint not null references groups(id),
  name text not null,
  issuer text not null,
  asset_number text,
  asset_type text not null,
  current_balance_cents integer not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, name),
  constraint assets_asset_number_required check (
    asset_type = 'cash' or asset_number is not null
  )
);

create unique index if not exists assets_asset_number_unique
  on assets (issuer, asset_number)
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

create table if not exists websms_logs (
  id bigserial primary key,
  group_id bigint not null references groups(id),
  asset_id bigint references assets(id),
  received_at timestamptz not null,
  text_length integer not null,
  text_preview text not null,
  text text,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  unique (group_id, received_at, text_length, text_preview)
);

create index if not exists websms_logs_received_at_idx
  on websms_logs (received_at desc);

create table if not exists user_api_keys (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  api_key text not null unique,
  created_at timestamptz not null default now()
);

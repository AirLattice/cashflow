create table if not exists user_api_keys (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  api_key text not null unique,
  created_at timestamptz not null default now()
);

drop table if exists websms_api_keys;

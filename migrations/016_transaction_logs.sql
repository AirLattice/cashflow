create table if not exists transaction_logs (
  id bigserial primary key,
  transaction_id bigint,
  group_id bigint not null references groups(id),
  user_id bigint not null references users(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transaction_logs_group_id_idx
  on transaction_logs (group_id, created_at desc);

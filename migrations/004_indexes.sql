create index if not exists assets_group_id_idx
  on assets (group_id);

create index if not exists transactions_group_occurred_idx
  on transactions (group_id, occurred_at desc);

create index if not exists websms_logs_group_received_idx
  on websms_logs (group_id, received_at desc);

create index if not exists user_group_access_user_created_idx
  on user_group_access (user_id, created_at);

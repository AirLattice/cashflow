alter table websms_logs
  add column if not exists asset_id bigint references assets(id);

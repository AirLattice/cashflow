alter table websms_logs
  add column if not exists group_id bigint references groups(id);

update websms_logs
set group_id = (select id from groups where name = 'family' limit 1)
where group_id is null;

alter table websms_logs
  alter column group_id set not null;

alter table websms_logs
  drop constraint if exists websms_logs_received_at_text_length_text_preview_key;

create unique index if not exists websms_logs_group_received_key
  on websms_logs (group_id, received_at, text_length, text_preview);

create table if not exists websms_api_keys (
  id bigserial primary key,
  group_id bigint not null references groups(id) on delete cascade,
  api_key text not null unique,
  created_at timestamptz not null default now()
);

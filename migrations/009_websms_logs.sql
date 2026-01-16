create table if not exists websms_logs (
  id bigserial primary key,
  received_at timestamptz not null,
  text_length integer not null,
  text_preview text not null,
  text text,
  created_at timestamptz not null default now(),
  unique (received_at, text_length, text_preview)
);

create index if not exists websms_logs_received_at_idx
  on websms_logs (received_at desc);

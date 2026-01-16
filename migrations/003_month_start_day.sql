do $$
begin
  create table if not exists group_settings (
    group_id bigint primary key references groups(id) on delete cascade,
    month_start_day integer not null default 1,
    updated_at timestamptz not null default now()
  );

  insert into group_settings (group_id, month_start_day)
  select id, 1 from groups
  on conflict (group_id) do nothing;
end $$;

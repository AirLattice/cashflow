do $$
begin
  create table if not exists app_settings (
    id integer primary key,
    month_start_day integer not null default 1,
    updated_at timestamptz not null default now()
  );

  insert into app_settings (id, month_start_day)
  values (1, 1)
  on conflict (id) do nothing;
end $$;

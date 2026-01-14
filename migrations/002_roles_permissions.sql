do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'users' and column_name = 'role'
  ) then
    alter table users add column role text not null default 'user';
  end if;

  create table if not exists user_permissions (
    user_id bigint primary key references users(id) on delete cascade,
    can_view_fixed_expenses boolean not null default false,
    can_view_incomes boolean not null default false,
    can_view_summary boolean not null default false,
    created_at timestamptz not null default now()
  );

  insert into user_permissions (user_id)
  select id from users
  on conflict (user_id) do nothing;
end $$;

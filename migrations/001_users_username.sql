do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'users' and column_name = 'username'
  ) then
    alter table users add column username text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'users' and column_name = 'email'
  ) then
    update users set username = email where username is null;
    alter table users drop constraint if exists users_email_key;
    alter table users drop column if exists email;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'users' and column_name = 'username'
  ) then
    alter table users alter column username set not null;
    create unique index if not exists users_username_key on users(username);
  end if;
end $$;

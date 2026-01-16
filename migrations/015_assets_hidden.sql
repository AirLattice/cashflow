alter table assets
  add column if not exists hidden boolean not null default false;

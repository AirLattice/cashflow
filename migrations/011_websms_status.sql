alter table websms_logs
  add column if not exists status text;

update websms_logs
set status = 'unmatched'
where status is null;

alter table websms_logs
  alter column status set not null;

alter table websms_logs
  alter column status set default 'unmatched';

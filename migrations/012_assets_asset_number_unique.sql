alter table assets
  add constraint assets_asset_number_required
  check (asset_type = 'cash' or asset_number is not null);

drop index if exists assets_group_asset_number_key;

create unique index if not exists assets_asset_number_unique
  on assets (issuer, asset_number)
  where asset_number is not null;

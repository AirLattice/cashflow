alter table fixed_expenses
  add column if not exists interest_rate numeric,
  add column if not exists total_interest_cents integer,
  add column if not exists total_with_interest_cents integer,
  add column if not exists remaining_cents integer;

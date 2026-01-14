# Cashflow API

Basic Node/Express + Postgres API for fixed monthly expenses and income tracking.

## Run (Docker)

1. Build and start:

```bash
docker compose up --build
```

API and web UI will be available at http://localhost:8081.
Account management page: http://localhost:8081/account.html

## Auth

- POST /auth/register { "username": "myid", "password": "secret" }
- POST /auth/login { "username": "myid", "password": "secret" }
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me
- POST /auth/change-password { "current_password": "...", "new_password": "..." }
- POST /auth/delete-account { "password": "..." }

Cookies:
- access_token (1 hour)
- refresh_token (7 days)

Password policy:
- At least 10 characters
- Must include letters, numbers, and symbols

## Migration (existing DB)

If you created accounts before switching to `username`, run:

```bash
cat migrations/001_users_username.sql | docker compose exec -T db psql -U postgres -d cashflow
```

## Fixed expenses

- GET /fixed-expenses?month=YYYY-MM
- POST /fixed-expenses
- PUT /fixed-expenses/:id
- DELETE /fixed-expenses/:id

Create payload example:

```json
{
  "name": "Rent",
  "total_amount_cents": 1000000,
  "per_month_cents": 1000000,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "payment_type": "single",
  "installments_count": null
}
```

## Incomes

- GET /incomes?month=YYYY-MM
- POST /incomes
- PUT /incomes/:id
- DELETE /incomes/:id

Create payload example:

```json
{
  "name": "Salary",
  "amount_cents": 3500000,
  "income_date": "2024-07-25"
}
```

## Summary

- GET /summary?month=YYYY-MM

Response:

```json
{
  "month": "2024-07",
  "total_income_cents": 3500000,
  "total_fixed_expense_cents": 1000000,
  "balance_cents": 2500000
}
```

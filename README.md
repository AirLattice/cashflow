# Cashflow API

Basic Node/Express + Postgres API for fixed monthly expenses and income tracking.

## Run (Docker)

1. Build and start:

```bash
docker compose up --build
```

API and web UI will be available at http://localhost:8081.
Account management page: http://localhost:8081/account.html
Admin page: http://localhost:8081/admin.html

## Auth

- POST /auth/register { "username": "myid", "password": "secret" }
- POST /auth/login { "username": "myid", "password": "secret" }
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me
- POST /auth/change-password { "current_password": "...", "new_password": "..." }
- POST /auth/delete-account { "password": "..." }

Admin:
- GET /admin/users
- PUT /admin/users/:id/permissions { "role": "admin|user", "can_view_fixed_expenses": true, "can_view_incomes": true, "can_view_summary": true }
- GET /admin/settings
- PUT /admin/settings { "month_start_day": 15 }

Cookies:
- access_token (1 hour)
- refresh_token (7 days)

Password policy:
- At least 10 characters
- Must include letters, numbers, and symbols

Admin account:
- username: admin
- password: admin
- First login should change the password.

Permissions:
- New users start with no access to fixed expenses, incomes, or summary.
- Admin must grant permissions via the admin page.

Month 기준:
- `month_start_day` 값을 기준으로 월 집계 기간을 계산합니다.
- 예: 15로 설정하면 15일~다음달 14일이 한 달입니다.

## Migration (existing DB)

If you created accounts before switching to `username`, run:

```bash
cat migrations/001_users_username.sql | docker compose exec -T db psql -U postgres -d cashflow
```

Permissions/roles migration:

```bash
cat migrations/002_roles_permissions.sql | docker compose exec -T db psql -U postgres -d cashflow
```

Month 기준 설정 migration:

```bash
cat migrations/003_month_start_day.sql | docker compose exec -T db psql -U postgres -d cashflow
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

## WebSMS

- POST /websms
- Header: `x-api-key: <WEBSMS_API_KEY>`
- Body:

```json
{
  "text": "카드 승인 12,300원 ..."
}
```

Notes:
- `WEBSMS_API_KEY` env var로 인증합니다.
- 설정이 없으면 서버가 임시 키를 로그로 출력합니다.

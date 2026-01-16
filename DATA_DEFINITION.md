# cashflow 데이터 정의

이 문서는 현재 DB 스키마를 기준으로 정리한 데이터 정의입니다.

## 공통 규칙
- 금액 필드는 `*_cents`로 저장 (원 단위 정수).
- 날짜는 `date`, 생성 시각은 `timestamptz`.
- 사용자 범위는 `group_id`로 구분.

## 테이블

### users
- id (bigserial, PK)
- username (text, UNIQUE, NOT NULL)
- role (text, NOT NULL, default: 'user')
- password_hash (text, NOT NULL)
- active_group_id (bigint, FK -> groups.id)
- created_at (timestamptz, default now)

### groups
- id (bigserial, PK)
- name (text, UNIQUE, NOT NULL)
- created_at (timestamptz, default now)

### user_group_access
- user_id (bigint, FK -> users.id, PK part)
- group_id (bigint, FK -> groups.id, PK part)
- created_at (timestamptz, default now)

### user_permissions
- user_id (bigint, PK, FK -> users.id)
- can_view_fixed_expenses (boolean, default false)
- can_view_incomes (boolean, default false)
- can_view_summary (boolean, default false)
- created_at (timestamptz, default now)

### refresh_tokens
- id (bigserial, PK)
- user_id (bigint, FK -> users.id)
- token_hash (text, UNIQUE, NOT NULL)
- expires_at (timestamptz, NOT NULL)
- revoked_at (timestamptz)
- created_at (timestamptz, default now)

### group_settings
- group_id (bigint, PK, FK -> groups.id)
- month_start_day (integer, NOT NULL, default 1)
- updated_at (timestamptz, default now)

### fixed_expenses
- id (bigserial, PK)
- user_id (bigint, FK -> users.id)
- group_id (bigint, FK -> groups.id, NOT NULL)
- name (text, NOT NULL)
- total_amount_cents (integer, NOT NULL)
- per_month_cents (integer, NOT NULL)
- start_date (date, NOT NULL)
- end_date (date, NOT NULL)
- payment_type (text, default 'single')
- installments_count (integer, nullable)
- interest_rate (numeric, nullable)
- total_interest_cents (integer, nullable)
- total_with_interest_cents (integer, nullable)
- remaining_cents (integer, nullable)
- created_at (timestamptz, default now)

### incomes
- id (bigserial, PK)
- user_id (bigint, FK -> users.id)
- group_id (bigint, FK -> groups.id, NOT NULL)
- name (text, NOT NULL)
- amount_cents (integer, NOT NULL)
- income_date (date, NOT NULL)
- created_at (timestamptz, default now)

## 관계 요약
- users 1:N refresh_tokens
- users 1:1 user_permissions
- users N:M groups (user_group_access)
- groups 1:N fixed_expenses
- groups 1:N incomes
- users 1:N fixed_expenses
- users 1:N incomes
- groups 1:1 group_settings

## 관계 다이어그램 (ASCII)
```
users ──┬──────────────< refresh_tokens
        ├─────────────── user_permissions
        ├──────────────< fixed_expenses >────────── groups
        ├──────────────< incomes       >────────── groups
        └──< user_group_access >─────── groups ─── group_settings
```

## 참고
- 초기 그룹은 'family'로 생성되며, 기존 사용자에 기본으로 연결됨.

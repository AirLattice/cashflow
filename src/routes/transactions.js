import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

const DIRECTIONS = new Set(["deposit", "withdraw"]);

async function resolveAsset(req, assetId, assetName) {
  if (assetId) {
    const result = await query(
      "select id, asset_type from assets where id = $1 and group_id = $2",
      [assetId, req.user.group_id]
    );
    return result.rows[0];
  }
  if (assetName) {
    const result = await query(
      "select id, asset_type from assets where name = $1 and group_id = $2",
      [assetName, req.user.group_id]
    );
    return result.rows[0];
  }
  return null;
}

function isCardOrLoan(type) {
  return type === "card" || type === "loan";
}

export async function listTransactions(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  let range = null;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "start_date and end_date are required" });
    }
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "invalid date format, use YYYY-MM-DD" });
    }
    if (start > end) {
      return res.status(400).json({ error: "start_date must be before end_date" });
    }
    range = { start, end };
  } else {
    const monthStartDay = await getMonthStartDay();
    const monthRange = getPeriodRange(monthStartDay, req.query.month);
    if (req.query.month && !monthRange) {
      return res.status(400).json({ error: "invalid month format, use YYYY-MM" });
    }
    range = monthRange;
  }

  const assetId = req.query.asset_id ? Number(req.query.asset_id) : null;
  const params = [req.user.group_id];
  let sql = `
    select t.*, a.name as asset_name, a.asset_type, u.username
    from transactions t
    join assets a on t.asset_id = a.id
    join users u on t.user_id = u.id
    where t.group_id = $1
  `;
  if (range) {
    params.push(range.start, range.end);
    sql += ` and t.occurred_at >= $${params.length - 1} and t.occurred_at <= $${params.length} `;
  }
  if (assetId) {
    params.push(assetId);
    sql += ` and t.asset_id = $${params.length} `;
  }
  sql += " order by t.occurred_at asc, t.id asc";

  const result = await query(sql, params);
  return res.json({ items: result.rows });
}

export async function createTransaction(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const {
    asset_id,
    asset_name,
    direction,
    amount_cents,
    principal_cents,
    installment_count,
    interest_rate,
    memo
  } = req.body;

  if (!direction || !DIRECTIONS.has(direction)) {
    return res.status(400).json({ error: "invalid direction" });
  }
  const amount = Number(amount_cents);
  if (!Number.isFinite(amount)) {
    return res.status(400).json({ error: "invalid amount_cents" });
  }

  const asset = await resolveAsset(req, asset_id, asset_name);
  if (!asset) {
    return res.status(404).json({ error: "asset not found" });
  }

  if (isCardOrLoan(asset.asset_type)) {
    const principal = Number(principal_cents);
    const installments = Number(installment_count);
    const rate = Number(interest_rate);
    if (!Number.isFinite(principal) || !Number.isFinite(installments) || !Number.isFinite(rate)) {
      return res.status(400).json({ error: "missing installment fields" });
    }
  }

  const result = await query(
    "insert into transactions (group_id, asset_id, user_id, direction, amount_cents, principal_cents, installment_count, interest_rate, memo) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *",
    [
      req.user.group_id,
      asset.id,
      req.user.id,
      direction,
      amount,
      principal_cents || null,
      installment_count || null,
      interest_rate || null,
      memo || null
    ]
  );

  return res.status(201).json({ item: result.rows[0] });
}

export async function updateTransaction(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const {
    asset_id,
    asset_name,
    direction,
    amount_cents,
    principal_cents,
    installment_count,
    interest_rate,
    memo
  } = req.body;

  if (!direction || !DIRECTIONS.has(direction)) {
    return res.status(400).json({ error: "invalid direction" });
  }
  const amount = Number(amount_cents);
  if (!Number.isFinite(amount)) {
    return res.status(400).json({ error: "invalid amount_cents" });
  }

  const existing = await query(
    "select user_id from transactions where id = $1 and group_id = $2",
    [req.params.id, req.user.group_id]
  );
  const row = existing.rows[0];
  if (!row) {
    return res.status(404).json({ error: "not found" });
  }
  if (req.user.role !== "admin" && row.user_id !== req.user.id) {
    return res.status(403).json({ error: "not allowed" });
  }

  const asset = await resolveAsset(req, asset_id, asset_name);
  if (!asset) {
    return res.status(404).json({ error: "asset not found" });
  }

  if (isCardOrLoan(asset.asset_type)) {
    const principal = Number(principal_cents);
    const installments = Number(installment_count);
    const rate = Number(interest_rate);
    if (!Number.isFinite(principal) || !Number.isFinite(installments) || !Number.isFinite(rate)) {
      return res.status(400).json({ error: "missing installment fields" });
    }
  }

  const result = await query(
    "update transactions set asset_id = $1, direction = $2, amount_cents = $3, principal_cents = $4, installment_count = $5, interest_rate = $6, memo = $7 where id = $8 and group_id = $9 returning *",
    [
      asset.id,
      direction,
      amount,
      principal_cents || null,
      installment_count || null,
      interest_rate || null,
      memo || null,
      req.params.id,
      req.user.group_id
    ]
  );

  return res.json({ item: result.rows[0] });
}

export async function deleteTransaction(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }

  const existing = await query(
    "select user_id from transactions where id = $1 and group_id = $2",
    [req.params.id, req.user.group_id]
  );
  const row = existing.rows[0];
  if (!row) {
    return res.status(404).json({ error: "not found" });
  }
  if (req.user.role !== "admin" && row.user_id !== req.user.id) {
    return res.status(403).json({ error: "not allowed" });
  }

  await query("delete from transactions where id = $1 and group_id = $2", [
    req.params.id,
    req.user.group_id
  ]);

  return res.json({ ok: true });
}

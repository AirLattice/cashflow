import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

export async function listFixedExpenses(req, res) {
  const monthStartDay = await getMonthStartDay();
  const monthRange = getPeriodRange(monthStartDay, req.query.month);
  if (req.query.month && !monthRange) {
    return res.status(400).json({ error: "invalid month format, use YYYY-MM" });
  }
  let result;
  result = await query(
    "select * from fixed_expenses where user_id = $1 and start_date <= $2 and end_date >= $3 order by id desc",
    [req.user.id, monthRange.end, monthRange.start]
  );

  return res.json({ items: result.rows });
}

export async function createFixedExpense(req, res) {
  const {
    name,
    total_amount_cents,
    per_month_cents,
    start_date,
    end_date,
    payment_type,
    installments_count
  } = req.body;

  if (!name || !total_amount_cents || !per_month_cents || !start_date || !end_date) {
    return res.status(400).json({ error: "missing required fields" });
  }

  const result = await query(
    "insert into fixed_expenses (user_id, name, total_amount_cents, per_month_cents, start_date, end_date, payment_type, installments_count) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *",
    [
      req.user.id,
      name,
      total_amount_cents,
      per_month_cents,
      start_date,
      end_date,
      payment_type || "single",
      installments_count || null
    ]
  );

  return res.status(201).json({ item: result.rows[0] });
}

export async function updateFixedExpense(req, res) {
  const {
    name,
    total_amount_cents,
    per_month_cents,
    start_date,
    end_date,
    payment_type,
    installments_count
  } = req.body;

  if (!name || !total_amount_cents || !per_month_cents || !start_date || !end_date) {
    return res.status(400).json({ error: "missing required fields" });
  }

  const result = await query(
    "update fixed_expenses set name = $1, total_amount_cents = $2, per_month_cents = $3, start_date = $4, end_date = $5, payment_type = $6, installments_count = $7 where id = $8 and user_id = $9 returning *",
    [
      name,
      total_amount_cents,
      per_month_cents,
      start_date,
      end_date,
      payment_type || "single",
      installments_count || null,
      req.params.id,
      req.user.id
    ]
  );

  const item = result.rows[0];
  if (!item) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ item });
}

export async function deleteFixedExpense(req, res) {
  const result = await query(
    "delete from fixed_expenses where id = $1 and user_id = $2 returning id",
    [req.params.id, req.user.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ ok: true });
}

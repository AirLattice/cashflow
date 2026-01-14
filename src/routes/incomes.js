import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

export async function listIncomes(req, res) {
  const monthStartDay = await getMonthStartDay();
  const monthRange = getPeriodRange(monthStartDay, req.query.month);
  if (req.query.month && !monthRange) {
    return res.status(400).json({ error: "invalid month format, use YYYY-MM" });
  }
  let result;
  result = await query(
    "select * from incomes where user_id = $1 and income_date >= $2 and income_date <= $3 order by income_date desc",
    [req.user.id, monthRange.start, monthRange.end]
  );

  return res.json({ items: result.rows });
}

export async function createIncome(req, res) {
  const { name, amount_cents, income_date } = req.body;
  if (!name || !amount_cents || !income_date) {
    return res.status(400).json({ error: "missing required fields" });
  }

  const result = await query(
    "insert into incomes (user_id, name, amount_cents, income_date) values ($1, $2, $3, $4) returning *",
    [req.user.id, name, amount_cents, income_date]
  );

  return res.status(201).json({ item: result.rows[0] });
}

export async function updateIncome(req, res) {
  const { name, amount_cents, income_date } = req.body;
  if (!name || !amount_cents || !income_date) {
    return res.status(400).json({ error: "missing required fields" });
  }
  const result = await query(
    "update incomes set name = $1, amount_cents = $2, income_date = $3 where id = $4 and user_id = $5 returning *",
    [name, amount_cents, income_date, req.params.id, req.user.id]
  );

  const item = result.rows[0];
  if (!item) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ item });
}

export async function deleteIncome(req, res) {
  const result = await query(
    "delete from incomes where id = $1 and user_id = $2 returning id",
    [req.params.id, req.user.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ ok: true });
}

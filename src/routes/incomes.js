import { query } from "../db.js";

function parseMonth(month) {
  const [yearStr, monthStr] = (month || "").split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { start, end };
}

export async function listIncomes(req, res) {
  const monthRange = parseMonth(req.query.month);
  let result;
  if (monthRange) {
    result = await query(
      "select * from incomes where user_id = $1 and income_date >= $2 and income_date <= $3 order by income_date desc",
      [req.user.id, monthRange.start, monthRange.end]
    );
  } else {
    result = await query("select * from incomes where user_id = $1 order by income_date desc", [
      req.user.id
    ]);
  }

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

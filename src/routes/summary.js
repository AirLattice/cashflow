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

export async function getSummary(req, res) {
  const monthRange = parseMonth(req.query.month);
  if (!monthRange) {
    return res.status(400).json({ error: "month query required, format YYYY-MM" });
  }

  const expensesResult = await query(
    "select coalesce(sum(per_month_cents), 0) as total from fixed_expenses where user_id = $1 and start_date <= $2 and end_date >= $3",
    [req.user.id, monthRange.end, monthRange.start]
  );
  const incomesResult = await query(
    "select coalesce(sum(amount_cents), 0) as total from incomes where user_id = $1 and income_date >= $2 and income_date <= $3",
    [req.user.id, monthRange.start, monthRange.end]
  );

  const totalExpenses = Number(expensesResult.rows[0].total || 0);
  const totalIncome = Number(incomesResult.rows[0].total || 0);

  return res.json({
    month: req.query.month,
    total_income_cents: totalIncome,
    total_fixed_expense_cents: totalExpenses,
    balance_cents: totalIncome - totalExpenses
  });
}

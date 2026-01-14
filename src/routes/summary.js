import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

export async function getSummary(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const monthStartDay = await getMonthStartDay();
  const monthRange = getPeriodRange(monthStartDay, req.query.month);
  if (!monthRange) {
    return res.status(400).json({ error: "invalid month format, use YYYY-MM" });
  }

  const expensesResult = await query(
    "select coalesce(sum(per_month_cents), 0) as total from fixed_expenses where group_id = $1 and start_date <= $2 and end_date >= $3",
    [req.user.group_id, monthRange.end, monthRange.start]
  );
  const incomesResult = await query(
    "select coalesce(sum(amount_cents), 0) as total from incomes where group_id = $1 and income_date >= $2 and income_date <= $3",
    [req.user.group_id, monthRange.start, monthRange.end]
  );

  const totalExpenses = Number(expensesResult.rows[0].total || 0);
  const totalIncome = Number(incomesResult.rows[0].total || 0);

  return res.json({
    month: monthRange.label,
    period_start: monthRange.start,
    period_end: monthRange.end,
    total_income_cents: totalIncome,
    total_fixed_expense_cents: totalExpenses,
    balance_cents: totalIncome - totalExpenses
  });
}

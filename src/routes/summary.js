import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

export async function getSummary(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const monthStartDay = await getMonthStartDay(req.user.group_id);
  const monthRange = getPeriodRange(monthStartDay, req.query.month);
  if (req.query.month && !monthRange) {
    return res.status(400).json({ error: "invalid month format, use YYYY-MM" });
  }

  const result = await query(
    "select direction, coalesce(sum(amount_cents), 0) as total from transactions where group_id = $1 and occurred_at >= $2 and occurred_at <= $3 group by direction",
    [req.user.group_id, monthRange.start, monthRange.end]
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  result.rows.forEach((row) => {
    if (row.direction === "deposit") {
      totalIncome = Number(row.total || 0);
    } else if (row.direction === "withdraw") {
      totalExpenses = Number(row.total || 0);
    }
  });

  return res.json({
    month: monthRange.label,
    period_start: monthRange.start,
    period_end: monthRange.end,
    total_income_cents: totalIncome,
    total_fixed_expense_cents: totalExpenses,
    balance_cents: totalIncome - totalExpenses
  });
}

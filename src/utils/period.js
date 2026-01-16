import { query } from "../db.js";

async function getGlobalMonthStartDay() {
  const fallback = 1;
  const result = await query("select month_start_day from app_settings where id = 1");
  if (result.rows.length === 0) {
    await query(
      "insert into app_settings (id, month_start_day) values (1, $1) on conflict do nothing",
      [fallback]
    );
    return fallback;
  }
  const value = Number(result.rows[0].month_start_day || fallback);
  if (Number.isNaN(value) || value < 1 || value > 28) {
    return fallback;
  }
  return value;
}

export async function getMonthStartDay(groupId = null) {
  try {
    const fallback = await getGlobalMonthStartDay();
    if (!groupId) {
      return fallback;
    }
    const result = await query(
      "select month_start_day from group_settings where group_id = $1",
      [groupId]
    );
    if (result.rows.length === 0) {
      await query(
        "insert into group_settings (group_id, month_start_day) values ($1, $2) on conflict do nothing",
        [groupId, fallback]
      );
      return fallback;
    }
    const value = Number(result.rows[0].month_start_day || fallback);
    if (Number.isNaN(value) || value < 1 || value > 28) {
      return fallback;
    }
    return value;
  } catch (err) {
    return 1;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseMonthKey(month) {
  const [yearStr, monthStr] = (month || "").split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return { year, monthIndex };
}

export function getPeriodRange(monthStartDay, monthKey, today = new Date()) {
  const startDay = Number(monthStartDay) || 1;
  let base;
  if (monthKey) {
    const parsed = parseMonthKey(monthKey);
    if (!parsed) {
      return null;
    }
    base = parsed;
  } else {
    let year = today.getFullYear();
    let monthIndex = today.getMonth();
    if (today.getDate() < startDay) {
      monthIndex -= 1;
      if (monthIndex < 0) {
        monthIndex = 11;
        year -= 1;
      }
    }
    base = { year, monthIndex };
  }

  const start = new Date(Date.UTC(base.year, base.monthIndex, startDay));
  const end = new Date(Date.UTC(base.year, base.monthIndex + 1, startDay - 1));
  const label = `${base.year}-${pad(base.monthIndex + 1)}`;
  return { start, end, label };
}

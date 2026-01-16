import crypto from "crypto";
import { query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

export async function listUsers(req, res) {
  const result = await query(
    "select u.id, u.username, u.role, u.active_group_id, g.name as group_name, p.can_view_assets, p.can_view_transactions, p.can_view_summary from users u left join groups g on u.active_group_id = g.id left join user_permissions p on u.id = p.user_id order by u.id asc"
  );

  const users = result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    group_id: row.active_group_id,
    group_name: row.group_name,
    permissions: {
      assets: Boolean(row.can_view_assets),
      transactions: Boolean(row.can_view_transactions),
      summary: Boolean(row.can_view_summary)
    }
  }));

  return res.json({ users });
}

export async function updateUserPermissions(req, res) {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: "invalid user id" });
  }

  const { role, can_view_assets, can_view_transactions, can_view_summary, group_id } =
    req.body;

  if (
    typeof can_view_assets !== "boolean" ||
    typeof can_view_transactions !== "boolean" ||
    typeof can_view_summary !== "boolean"
  ) {
    return res.status(400).json({ error: "permissions must be boolean" });
  }

  if (role && role !== "admin" && role !== "user") {
    return res.status(400).json({ error: "invalid role" });
  }

  const userResult = await query("select id, role from users where id = $1", [userId]);
  const targetUser = userResult.rows[0];
  if (!targetUser) {
    return res.status(404).json({ error: "user not found" });
  }

  if (role && role !== "admin" && userId === req.user.id) {
    return res.status(400).json({ error: "cannot demote self" });
  }

  let groupId = null;
  if (group_id !== undefined && group_id !== null) {
    const parsed = Number(group_id);
    if (!parsed) {
      return res.status(400).json({ error: "group_id is required" });
    }
    const groupResult = await query("select id from groups where id = $1", [parsed]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "group not found" });
    }
    groupId = parsed;
  }

  await query("insert into user_permissions (user_id) values ($1) on conflict do nothing", [
    userId
  ]);

  await query(
    "update user_permissions set can_view_assets = $1, can_view_transactions = $2, can_view_summary = $3 where user_id = $4",
    [can_view_assets, can_view_transactions, can_view_summary, userId]
  );

  if (role) {
    await query("update users set role = $1 where id = $2", [role, userId]);
  }
  if (groupId) {
    await query("update users set active_group_id = $1 where id = $2", [groupId, userId]);
    await query(
      "insert into user_group_access (user_id, group_id) values ($1, $2) on conflict do nothing",
      [userId, groupId]
    );
  }

  return res.json({ ok: true });
}

export async function listGroups(req, res) {
  const result = await query("select id, name from groups order by name asc");
  return res.json({ groups: result.rows });
}

export async function createGroup(req, res) {
  const name = String(req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "group name is required" });
  }

  const result = await query(
    "insert into groups (name) values ($1) on conflict (name) do update set name = excluded.name returning id, name",
    [name]
  );

  return res.status(201).json({ group: result.rows[0] });
}

export async function getSettings(req, res) {
  const result = await query("select month_start_day from app_settings where id = 1");
  if (result.rows.length === 0) {
    await query(
      "insert into app_settings (id, month_start_day) values (1, 1) on conflict do nothing"
    );
    return res.json({ month_start_day: 1 });
  }
  return res.json({ month_start_day: Number(result.rows[0].month_start_day || 1) });
}

export async function updateSettings(req, res) {
  const { month_start_day } = req.body;
  const value = Number(month_start_day);
  if (!Number.isInteger(value) || value < 1 || value > 28) {
    return res.status(400).json({ error: "month_start_day must be 1-28" });
  }

  await query(
    "insert into app_settings (id, month_start_day, updated_at) values (1, $1, now()) on conflict (id) do update set month_start_day = excluded.month_start_day, updated_at = now()",
    [value]
  );
  return res.json({ ok: true, month_start_day: value });
}

export async function listWebSmsKeys(req, res) {
  const result = await query(
    "select k.id, k.group_id, g.name as group_name, k.api_key, k.created_at from websms_api_keys k join groups g on k.group_id = g.id order by g.name asc, k.created_at desc"
  );
  return res.json({ items: result.rows });
}

export async function createWebSmsKey(req, res) {
  const groupId = Number(req.body.group_id);
  if (!groupId) {
    return res.status(400).json({ error: "group_id is required" });
  }
  const groupResult = await query("select id, name from groups where id = $1", [groupId]);
  const group = groupResult.rows[0];
  if (!group) {
    return res.status(404).json({ error: "group not found" });
  }

  const apiKey = crypto.randomBytes(24).toString("base64url");
  const result = await query(
    "insert into websms_api_keys (group_id, api_key) values ($1, $2) returning id, group_id, api_key, created_at",
    [groupId, apiKey]
  );

  return res.status(201).json({
    item: { ...result.rows[0], group_name: group.name }
  });
}

export async function getGroupSummary(req, res) {
  const userId = Number(req.query.user_id);
  const groupId = Number(req.query.group_id);
  if (!userId || !groupId) {
    return res.status(400).json({ error: "user_id and group_id are required" });
  }

  const userResult = await query(
    "select u.role, p.can_view_assets, p.can_view_transactions, p.can_view_summary from users u left join user_permissions p on u.id = p.user_id where u.id = $1",
    [userId]
  );
  const userRow = userResult.rows[0];
  if (!userRow) {
    return res.status(404).json({ error: "user not found" });
  }

  const allowed = {
    assets: userRow.role === "admin" ? true : Boolean(userRow.can_view_assets),
    transactions: userRow.role === "admin" ? true : Boolean(userRow.can_view_transactions),
    summary: userRow.role === "admin" ? true : Boolean(userRow.can_view_summary)
  };

  const monthStartDay = await getMonthStartDay();
  const period = getPeriodRange(monthStartDay);
  if (!period) {
    return res.status(400).json({ error: "invalid period" });
  }

  let assets = null;
  if (allowed.assets) {
    const assetsResult = await query(
      "select count(*)::int as count, coalesce(sum(current_balance_cents), 0)::int as balance_cents from assets where group_id = $1",
      [groupId]
    );
    assets = assetsResult.rows[0] || { count: 0, balance_cents: 0 };
  }

  let transactions = null;
  if (allowed.transactions || allowed.summary) {
    const txResult = await query(
      `select
        count(*)::int as count,
        coalesce(sum(case when direction = 'deposit' then amount_cents else 0 end), 0)::int as deposits_cents,
        coalesce(sum(case when direction = 'withdraw' then amount_cents else 0 end), 0)::int as withdrawals_cents
      from transactions
      where group_id = $1 and occurred_at >= $2 and occurred_at <= $3`,
      [groupId, period.start, period.end]
    );
    const row = txResult.rows[0] || { count: 0, deposits_cents: 0, withdrawals_cents: 0 };
    transactions = {
      count: row.count,
      deposits_cents: row.deposits_cents,
      withdrawals_cents: row.withdrawals_cents,
      net_cents: row.deposits_cents - row.withdrawals_cents
    };
  }

  return res.json({
    permissions: allowed,
    period: { label: period.label, start_day: monthStartDay },
    assets,
    transactions
  });
}

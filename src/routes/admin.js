import { query } from "../db.js";

export async function listUsers(req, res) {
  const result = await query(
    "select u.id, u.username, u.role, u.active_group_id, g.name as group_name, p.can_view_fixed_expenses, p.can_view_incomes, p.can_view_summary from users u left join groups g on u.active_group_id = g.id left join user_permissions p on u.id = p.user_id order by u.id asc"
  );

  const users = result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    group_id: row.active_group_id,
    group_name: row.group_name,
    permissions: {
      fixed_expenses: Boolean(row.can_view_fixed_expenses),
      incomes: Boolean(row.can_view_incomes),
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

  const { role, can_view_fixed_expenses, can_view_incomes, can_view_summary, group_id } =
    req.body;

  if (
    typeof can_view_fixed_expenses !== "boolean" ||
    typeof can_view_incomes !== "boolean" ||
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
    "update user_permissions set can_view_fixed_expenses = $1, can_view_incomes = $2, can_view_summary = $3 where user_id = $4",
    [can_view_fixed_expenses, can_view_incomes, can_view_summary, userId]
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

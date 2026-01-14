import { query } from "../db.js";

export function requireAdmin(req, res, next) {
  return query("select role from users where id = $1", [req.user.id])
    .then((result) => {
      const user = result.rows[0];
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "admin only" });
      }
      return next();
    })
    .catch(() => res.status(500).json({ error: "failed to authorize" }));
}

export function requirePermission(permissionKey) {
  const columnMap = {
    fixed_expenses: "can_view_fixed_expenses",
    incomes: "can_view_incomes",
    summary: "can_view_summary"
  };
  const column = columnMap[permissionKey];
  if (!column) {
    return (req, res) => res.status(500).json({ error: "invalid permission" });
  }

  return (req, res, next) => {
    query(
      `select u.role, p.${column} as allowed from users u left join user_permissions p on u.id = p.user_id where u.id = $1`,
      [req.user.id]
    )
      .then((result) => {
        const row = result.rows[0];
        if (!row) {
          return res.status(403).json({ error: "forbidden" });
        }
        if (row.role === "admin") {
          return next();
        }
        if (!row.allowed) {
          return res.status(403).json({ error: "permission denied" });
        }
        return next();
      })
      .catch(() => res.status(500).json({ error: "failed to authorize" }));
  };
}

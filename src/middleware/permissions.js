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
    assets: "can_view_assets",
    transactions: "can_view_transactions",
    summary: "can_view_summary"
  };
  const column = columnMap[permissionKey];
  if (!column) {
    return (req, res) => res.status(500).json({ error: "invalid permission" });
  }

  return (req, res, next) => next();
}

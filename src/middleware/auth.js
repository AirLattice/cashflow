import jwt from "jsonwebtoken";
import { query } from "../db.js";

export function requireAuth(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) {
    return res.status(401).json({ error: "missing access token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return query("select id, role, active_group_id from users where id = $1", [payload.sub])
      .then((result) => {
        const user = result.rows[0];
        if (!user) {
          return res.status(401).json({ error: "user not found" });
        }
        req.user = { id: user.id, role: user.role, group_id: user.active_group_id };
        return next();
      })
      .catch(() => res.status(500).json({ error: "failed to authorize" }));
  } catch (err) {
    return res.status(401).json({ error: "invalid or expired access token" });
  }
}

import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  register,
  login,
  refresh,
  logout,
  me,
  listGroupsForUser,
  updateActiveGroup,
  changePassword,
  deleteAccount
} from "./routes/auth.js";
import { listAssets, createAsset, updateAsset, deleteAsset } from "./routes/assets.js";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from "./routes/transactions.js";
import { getSummary } from "./routes/summary.js";
import { requireAuth } from "./middleware/auth.js";
import { requireWebSmsApiKey } from "./middleware/websmsAuth.js";
import { requireAdmin, requirePermission } from "./middleware/permissions.js";
import {
  listUsers,
  updateUserPermissions,
  listGroups,
  createGroup,
  updateGroupStartDay,
  getGroupSummary
} from "./routes/admin.js";
import { receiveWebSms, listWebSmsLogs } from "./routes/websms.js";
import { query } from "./db.js";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const accept = req.headers.accept || "";
  const wantsHtml = accept.includes("text/html");
  if (!wantsHtml) {
    return next();
  }

  const path = req.path;
  if (path === "/" || path === "/index.html" || path === "/health" || path.startsWith("/auth/")) {
    return next();
  }

  const token = req.cookies?.access_token;
  if (!token) {
    return res.redirect("/");
  }

  try {
    jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return next();
  } catch (err) {
    return res.redirect("/");
  }
});
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});


app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/auth/refresh", refresh);
app.post("/auth/logout", logout);
app.get("/auth/me", requireAuth, me);
app.get("/auth/groups", requireAuth, listGroupsForUser);
app.put("/auth/active-group", requireAuth, updateActiveGroup);
app.post("/auth/change-password", requireAuth, changePassword);
app.post("/auth/delete-account", requireAuth, deleteAccount);

app.get("/assets", requireAuth, requirePermission("assets"), listAssets);
app.post("/assets", requireAuth, requirePermission("assets"), createAsset);
app.put("/assets/:id", requireAuth, requirePermission("assets"), updateAsset);
app.delete("/assets/:id", requireAuth, requirePermission("assets"), deleteAsset);

app.get("/transactions", requireAuth, requirePermission("transactions"), listTransactions);
app.post("/transactions", requireAuth, requirePermission("transactions"), createTransaction);
app.put("/transactions/:id", requireAuth, requirePermission("transactions"), updateTransaction);
app.delete("/transactions/:id", requireAuth, requirePermission("transactions"), deleteTransaction);

app.get("/summary", requireAuth, requirePermission("summary"), getSummary);

app.get("/admin/users", requireAuth, requireAdmin, listUsers);
app.put("/admin/users/:id/permissions", requireAuth, requireAdmin, updateUserPermissions);
app.get("/admin/groups", requireAuth, requireAdmin, listGroups);
app.post("/admin/groups", requireAuth, requireAdmin, createGroup);
app.put("/admin/groups/:id/start-day", requireAuth, requireAdmin, updateGroupStartDay);
app.get("/admin/group-summary", requireAuth, requireAdmin, getGroupSummary);
app.get("/admin/websms-logs", requireAuth, requireAdmin, listWebSmsLogs);

app.post("/websms", requireWebSmsApiKey, receiveWebSms);

async function ensureAdminSeed(attempt = 0) {
  try {
    const result = await query("select id from users where username = 'admin' limit 1");
    if (result.rows.length === 0) {
      const groupResult = await query(
        "select id from groups where name = 'family' limit 1"
      );
      const groupId = groupResult.rows[0]?.id;
      if (!groupId) {
        throw new Error("group not initialized");
      }
      const passwordHash = await bcrypt.hash("admin", 12);
      const userResult = await query(
        "insert into users (username, password_hash, role, active_group_id) values ('admin', $1, 'admin', $2) returning id",
        [passwordHash, groupId]
      );
      await query(
        "insert into user_permissions (user_id, can_view_assets, can_view_transactions, can_view_summary) values ($1, true, true, true) on conflict do nothing",
        [userResult.rows[0].id]
      );
      await query(
        "insert into user_group_access (user_id, group_id) values ($1, $2) on conflict do nothing",
        [userResult.rows[0].id, groupId]
      );
    }
  } catch (err) {
    if (attempt < 5) {
      setTimeout(() => ensureAdminSeed(attempt + 1), 2000);
      return;
    }
    console.error("failed to seed admin", err);
  }
}

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`cashflow api listening on ${port}`);
  ensureAdminSeed();
});

import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
  deleteAccount
} from "./routes/auth.js";
import {
  listFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense
} from "./routes/fixedExpenses.js";
import { listIncomes, createIncome, updateIncome, deleteIncome } from "./routes/incomes.js";
import { getSummary } from "./routes/summary.js";
import { requireAuth } from "./middleware/auth.js";
import { requireAdmin, requirePermission } from "./middleware/permissions.js";
import {
  listUsers,
  updateUserPermissions,
  getSettings,
  updateSettings,
  listGroups
} from "./routes/admin.js";
import { query } from "./db.js";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/admin", (req, res) => {
  res.redirect("/admin.html");
});

app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/auth/refresh", refresh);
app.post("/auth/logout", logout);
app.get("/auth/me", requireAuth, me);
app.post("/auth/change-password", requireAuth, changePassword);
app.post("/auth/delete-account", requireAuth, deleteAccount);

app.get("/fixed-expenses", requireAuth, requirePermission("fixed_expenses"), listFixedExpenses);
app.post(
  "/fixed-expenses",
  requireAuth,
  requirePermission("fixed_expenses"),
  createFixedExpense
);
app.put(
  "/fixed-expenses/:id",
  requireAuth,
  requirePermission("fixed_expenses"),
  updateFixedExpense
);
app.delete(
  "/fixed-expenses/:id",
  requireAuth,
  requirePermission("fixed_expenses"),
  deleteFixedExpense
);

app.get("/incomes", requireAuth, requirePermission("incomes"), listIncomes);
app.post("/incomes", requireAuth, requirePermission("incomes"), createIncome);
app.put("/incomes/:id", requireAuth, requirePermission("incomes"), updateIncome);
app.delete("/incomes/:id", requireAuth, requirePermission("incomes"), deleteIncome);

app.get("/summary", requireAuth, requirePermission("summary"), getSummary);

app.get("/admin/users", requireAuth, requireAdmin, listUsers);
app.put("/admin/users/:id/permissions", requireAuth, requireAdmin, updateUserPermissions);
app.get("/admin/groups", requireAuth, requireAdmin, listGroups);
app.get("/admin/settings", requireAuth, requireAdmin, getSettings);
app.put("/admin/settings", requireAuth, requireAdmin, updateSettings);

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
        "insert into user_permissions (user_id, can_view_fixed_expenses, can_view_incomes, can_view_summary) values ($1, true, true, true) on conflict do nothing",
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

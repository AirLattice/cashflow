import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
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

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/auth/refresh", refresh);
app.post("/auth/logout", logout);
app.get("/auth/me", requireAuth, me);
app.post("/auth/change-password", requireAuth, changePassword);
app.post("/auth/delete-account", requireAuth, deleteAccount);

app.get("/fixed-expenses", requireAuth, listFixedExpenses);
app.post("/fixed-expenses", requireAuth, createFixedExpense);
app.put("/fixed-expenses/:id", requireAuth, updateFixedExpense);
app.delete("/fixed-expenses/:id", requireAuth, deleteFixedExpense);

app.get("/incomes", requireAuth, listIncomes);
app.post("/incomes", requireAuth, createIncome);
app.put("/incomes/:id", requireAuth, updateIncome);
app.delete("/incomes/:id", requireAuth, deleteIncome);

app.get("/summary", requireAuth, getSummary);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`cashflow api listening on ${port}`);
});

const authStatus = document.getElementById("auth-status");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authPanel = document.getElementById("auth-panel");
const userMenuBtn = document.getElementById("user-menu-btn");
const userMenuPanel = document.getElementById("user-menu-panel");
const adminLink = document.getElementById("admin-link");
const summaryBtn = document.getElementById("summary-btn");
const summaryMonth = document.getElementById("summary-month");
const summaryIncome = document.getElementById("summary-income");
const summaryExpenses = document.getElementById("summary-expenses");
const summaryBalance = document.getElementById("summary-balance");
const incomeBar = document.getElementById("income-bar");
const expenseBar = document.getElementById("expense-bar");
const incomeBarValue = document.getElementById("income-bar-value");
const expenseBarValue = document.getElementById("expense-bar-value");
const tabs = document.querySelectorAll(".tab");
const permissionSections = document.querySelectorAll(".permission-section");
const mainLayout = document.querySelector("main.layout");

const formatter = new Intl.NumberFormat("ko-KR");
let currentPermissions = {};
let currentRole = null;
let currentUsername = "";
let currentActiveGroupId = null;
let summaryCacheKey = null;
let summaryCachePromise = null;

function setStatus(message) {
  if (authStatus) {
    authStatus.textContent = message;
  }
}

function setLoggedIn(isLoggedIn, username, role) {
  if (isLoggedIn) {
    setStatus("");
    authPanel.classList.add("hidden");
    userMenuBtn.textContent = username || "내 계정";
    userMenuBtn.classList.remove("hidden");
    currentUsername = username || "";
    if (mainLayout) {
      mainLayout.classList.remove("hidden");
      mainLayout.style.display = "grid";
    }
    document.body.classList.add("is-authenticated");
    if (adminLink) {
      adminLink.classList.toggle("hidden", role !== "admin");
    }
  } else {
    setStatus("로그인 필요");
    setTab("login");
    authPanel.classList.remove("hidden");
    userMenuBtn.classList.add("hidden");
    userMenuPanel.classList.add("hidden");
    currentActiveGroupId = null;
    if (mainLayout) {
      mainLayout.classList.add("hidden");
      mainLayout.style.display = "none";
    }
    document.body.classList.remove("is-authenticated");
    adminLink?.classList.add("hidden");
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
    if (summaryIncome) {
      summaryIncome.textContent = "-";
    }
    if (summaryExpenses) {
      summaryExpenses.textContent = "-";
    }
    if (summaryBalance) {
      summaryBalance.textContent = "-";
    }
    if (incomeBar) {
      incomeBar.style.width = "0%";
    }
    if (expenseBar) {
      expenseBar.style.width = "0%";
    }
    if (incomeBarValue) {
      incomeBarValue.textContent = "-";
    }
    if (expenseBarValue) {
      expenseBarValue.textContent = "-";
    }
  }
}

function applyPermissions(permissions, role, isAuthenticated = true) {
  const allowed = permissions || {};
  const isAdmin = role === "admin";
  currentPermissions = allowed;
  currentRole = role;
  if (typeof window.initNav === "function") {
    window.initNav({
      permissions: allowed,
      role,
      isAuthenticated,
      username: currentUsername,
      activeGroupId: currentActiveGroupId
    });
  }
  permissionSections.forEach((section) => {
    const key = section.dataset.permission;
    const isAllowed = isAdmin || Boolean(allowed[key]);
    section.classList.toggle("hidden", !isAllowed);
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getCurrentMonthKey(monthStartDay) {
  const today = new Date();
  let year = today.getFullYear();
  let monthIndex = today.getMonth();
  if (today.getDate() < monthStartDay) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }
  return `${year}-${pad(monthIndex + 1)}`;
}

function setDefaultMonthInputs(monthStartDay) {
  const key = getCurrentMonthKey(monthStartDay);
  if (summaryMonth) {
    summaryMonth.value = key;
  }
}

async function loadInitialData() {
  const isAdmin = currentRole === "admin";
  const canSummary = isAdmin || currentPermissions.summary;
  if (canSummary && summaryMonth) {
    await loadSummary();
    await loadChart();
  }
}

function setTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  loginForm.classList.toggle("hidden", name !== "login");
  registerForm.classList.toggle("hidden", name !== "register");
}

async function api(path, options = {}) {
  const requestWithRefresh = window.ApiClient?.requestWithRefresh;
  const refreshSession = window.ApiClient?.refreshSession;
  if (!requestWithRefresh) {
    throw new Error("API client not available");
  }
  return requestWithRefresh(path, options, refreshSession, () => setLoggedIn(false));
}

async function handleLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(loginForm));
  try {
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(data)
    });
    sessionStorage.setItem("username", data.username);
    await loadProfile();
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(registerForm));
  try {
    await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    });
    setStatus("회원가입 완료. 로그인해주세요.");
    setTab("login");
  } catch (err) {
    setStatus(err.message);
  }
}


async function loadProfile() {
  try {
    const data = await api("/auth/me");
    if (data.username) {
      sessionStorage.setItem("username", data.username);
    }
    setLoggedIn(true, data.username, data.role);
    currentActiveGroupId = data.active_group_id || null;
    applyPermissions(data.permissions || {}, data.role, true);
    const monthStartDay = Number(data.month_start_day || 1);
    setDefaultMonthInputs(monthStartDay);
    await loadInitialData();
  } catch (err) {
    setLoggedIn(false);
    applyPermissions({}, null, false);
  }
}

function monthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function loadSummary() {
  try {
    const data = await fetchSummaryData();
    if (summaryIncome) {
      summaryIncome.textContent = formatter.format(data.total_income_cents);
    }
    if (summaryExpenses) {
      summaryExpenses.textContent = formatter.format(data.total_fixed_expense_cents);
    }
    if (summaryBalance) {
      summaryBalance.textContent = formatter.format(data.balance_cents);
    }
  } catch (err) {
    setStatus(err.message);
  }
}

async function loadChart() {
  try {
    const data = await fetchSummaryData();
    const income = Number(data.total_income_cents || 0);
    const expense = Number(data.total_fixed_expense_cents || 0);
    const maxValue = Math.max(income, expense, 1);

    if (incomeBar) {
      incomeBar.style.width = `${(income / maxValue) * 100}%`;
    }
    if (expenseBar) {
      expenseBar.style.width = `${(expense / maxValue) * 100}%`;
    }
    if (incomeBarValue) {
      incomeBarValue.textContent = formatter.format(income);
    }
    if (expenseBarValue) {
      expenseBarValue.textContent = formatter.format(expense);
    }
  } catch (err) {
    setStatus(err.message);
  }
}

async function fetchSummaryData() {
  if (!summaryMonth) {
    throw new Error("summary month unavailable");
  }
  if (!summaryMonth.value) {
    summaryMonth.value = monthValue();
  }
  const month = summaryMonth.value;
  if (summaryCacheKey === month && summaryCachePromise) {
    return summaryCachePromise;
  }
  summaryCacheKey = month;
  summaryCachePromise = api(`/summary?month=${month}`).catch((err) => {
    if (summaryCacheKey === month) {
      summaryCacheKey = null;
      summaryCachePromise = null;
    }
    throw err;
  });
  return summaryCachePromise;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

if (summaryBtn) {
  summaryBtn.addEventListener("click", async () => {
    await loadSummary();
    await loadChart();
  });
}
loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

if (summaryMonth) {
  summaryMonth.value = monthValue();
}

loadProfile();

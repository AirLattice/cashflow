const authStatus = document.getElementById("auth-status");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutBtn = document.getElementById("logout-btn");
const authPanel = document.getElementById("auth-panel");
const userMenuBtn = document.getElementById("user-menu-btn");
const userMenuPanel = document.getElementById("user-menu-panel");
const changePasswordForm = document.getElementById("change-password-form");
const deleteAccountForm = document.getElementById("delete-account-form");
const adminLink = document.getElementById("admin-link");
const adminTopLink = document.getElementById("admin-top-link");
const summaryBtn = document.getElementById("summary-btn");
const summaryMonth = document.getElementById("summary-month");
const summaryIncome = document.getElementById("summary-income");
const summaryExpenses = document.getElementById("summary-expenses");
const summaryBalance = document.getElementById("summary-balance");
const chartMonth = document.getElementById("chart-month");
const chartBtn = document.getElementById("chart-btn");
const incomeBar = document.getElementById("income-bar");
const expenseBar = document.getElementById("expense-bar");
const incomeBarValue = document.getElementById("income-bar-value");
const expenseBarValue = document.getElementById("expense-bar-value");
const fixedForm = document.getElementById("fixed-form");
const fixedList = document.getElementById("fixed-list");
const fixedMonth = document.getElementById("fixed-month");
const fixedLoad = document.getElementById("fixed-load");
const incomeForm = document.getElementById("income-form");
const incomeList = document.getElementById("income-list");
const incomeMonth = document.getElementById("income-month");
const incomeLoad = document.getElementById("income-load");
const tabs = document.querySelectorAll(".tab");
const permissionSections = document.querySelectorAll(".permission-section");
const noAccessPanel = document.getElementById("no-access");

const formatter = new Intl.NumberFormat("ko-KR");
let refreshInFlight = null;

function setStatus(message) {
  authStatus.textContent = message;
}

function setLoggedIn(isLoggedIn, username, role) {
  if (isLoggedIn) {
    setStatus("로그인됨");
    authPanel.classList.add("hidden");
    userMenuBtn.textContent = username || "내 계정";
    userMenuBtn.classList.remove("hidden");
    document.body.classList.add("is-authenticated");
    if (role === "admin") {
      adminLink.classList.remove("hidden");
      adminTopLink.classList.remove("hidden");
    } else {
      adminLink.classList.add("hidden");
      adminTopLink.classList.add("hidden");
    }
  } else {
    setStatus("로그인 필요");
    authPanel.classList.remove("hidden");
    userMenuBtn.classList.add("hidden");
    userMenuPanel.classList.add("hidden");
    document.body.classList.remove("is-authenticated");
    adminLink.classList.add("hidden");
    adminTopLink.classList.add("hidden");
  }
}

function applyPermissions(permissions, role) {
  const allowed = permissions || {};
  const isAdmin = role === "admin";
  let anyVisible = false;
  permissionSections.forEach((section) => {
    const key = section.dataset.permission;
    const isAllowed = isAdmin || Boolean(allowed[key]);
    section.classList.toggle("hidden", !isAllowed);
    if (isAllowed) {
      anyVisible = true;
    }
  });
  noAccessPanel.classList.toggle("hidden", anyVisible);
}

function setTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  loginForm.classList.toggle("hidden", name !== "login");
  registerForm.classList.toggle("hidden", name !== "register");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include"
  });

  if (response.status === 401 && !options._retried) {
    try {
      await refreshSession();
      return api(path, { ...options, _retried: true });
    } catch (err) {
      setLoggedIn(false);
    }
  }

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      payload = { error: "Request failed" };
    }
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  const response = await refreshInFlight;
  if (!response.ok) {
    throw new Error("refresh failed");
  }
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

async function handleLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (err) {
    setStatus(err.message);
  }
  sessionStorage.removeItem("username");
  setLoggedIn(false);
}

async function handleChangePassword(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(changePasswordForm));
  try {
    await api("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    const username = sessionStorage.getItem("username");
    if (username) {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: data.new_password })
      });
      setStatus("비밀번호가 변경되었습니다.");
      await loadProfile();
    } else {
      setStatus("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      setLoggedIn(false);
    }
    changePasswordForm.reset();
    userMenuPanel.classList.add("hidden");
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleDeleteAccount(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(deleteAccountForm));
  if (!window.confirm("정말로 회원 탈퇴하시겠습니까?")) {
    return;
  }
  try {
    await api("/auth/delete-account", {
      method: "POST",
      body: JSON.stringify(data)
    });
    setStatus("회원 탈퇴가 완료되었습니다.");
    sessionStorage.removeItem("username");
    setLoggedIn(false);
    deleteAccountForm.reset();
    userMenuPanel.classList.add("hidden");
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
    applyPermissions(data.permissions || {}, data.role);
  } catch (err) {
    setLoggedIn(false);
    applyPermissions({});
    noAccessPanel.classList.add("hidden");
  }
}

function monthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function loadSummary() {
  if (!summaryMonth.value) {
    summaryMonth.value = monthValue();
  }
  try {
    const data = await api(`/summary?month=${summaryMonth.value}`);
    summaryIncome.textContent = formatter.format(data.total_income_cents);
    summaryExpenses.textContent = formatter.format(data.total_fixed_expense_cents);
    summaryBalance.textContent = formatter.format(data.balance_cents);
  } catch (err) {
    setStatus(err.message);
  }
}

async function loadChart() {
  const month = chartMonth.value || monthValue();
  chartMonth.value = month;
  try {
    const data = await api(`/summary?month=${month}`);
    const income = Number(data.total_income_cents || 0);
    const expense = Number(data.total_fixed_expense_cents || 0);
    const maxValue = Math.max(income, expense, 1);

    incomeBar.style.width = `${(income / maxValue) * 100}%`;
    expenseBar.style.width = `${(expense / maxValue) * 100}%`;
    incomeBarValue.textContent = formatter.format(income);
    expenseBarValue.textContent = formatter.format(expense);
  } catch (err) {
    setStatus(err.message);
  }
}

function renderFixed(items) {
  if (!items.length) {
    fixedList.innerHTML = "<p>등록된 고정 지출이 없습니다.</p>";
    return;
  }
  fixedList.innerHTML = items
    .map(
      (item) => `
      <div class="card-row">
        <div>
          <strong>${item.name}</strong>
          <small>${item.start_date} to ${item.end_date}</small>
        </div>
        <div>
          <small>총액</small>
          <div>${formatter.format(item.total_amount_cents)}</div>
        </div>
        <div>
          <small>월별 금액</small>
          <div>${formatter.format(item.per_month_cents)}</div>
        </div>
        <button class="ghost" data-action="delete-fixed" data-id="${item.id}">삭제</button>
      </div>
    `
    )
    .join("");
}

async function loadFixed() {
  const month = fixedMonth.value || monthValue();
  fixedMonth.value = month;
  try {
    const data = await api(`/fixed-expenses?month=${month}`);
    renderFixed(data.items);
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleFixedSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(fixedForm));
  data.total_amount_cents = Number(data.total_amount_cents || 0);
  data.per_month_cents = Number(data.per_month_cents || 0);
  data.installments_count = data.installments_count ? Number(data.installments_count) : null;
  try {
    await api("/fixed-expenses", {
      method: "POST",
      body: JSON.stringify(data)
    });
    fixedForm.reset();
    loadFixed();
    loadSummary();
  } catch (err) {
    setStatus(err.message);
  }
}

function renderIncome(items) {
  if (!items.length) {
    incomeList.innerHTML = "<p>등록된 수입이 없습니다.</p>";
    return;
  }
  incomeList.innerHTML = items
    .map(
      (item) => `
      <div class="card-row">
        <div>
          <strong>${item.name}</strong>
          <small>${item.income_date}</small>
        </div>
        <div>
          <small>금액</small>
          <div>${formatter.format(item.amount_cents)}</div>
        </div>
        <div>
          <small>등록번호</small>
          <div>#${item.id}</div>
        </div>
        <button class="ghost" data-action="delete-income" data-id="${item.id}">삭제</button>
      </div>
    `
    )
    .join("");
}

async function loadIncome() {
  const month = incomeMonth.value || monthValue();
  incomeMonth.value = month;
  try {
    const data = await api(`/incomes?month=${month}`);
    renderIncome(data.items);
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleIncomeSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(incomeForm));
  data.amount_cents = Number(data.amount_cents || 0);
  try {
    await api("/incomes", {
      method: "POST",
      body: JSON.stringify(data)
    });
    incomeForm.reset();
    loadIncome();
    loadSummary();
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleListClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  if (!action) {
    return;
  }
  const id = button.dataset.id;
  try {
    if (action === "delete-fixed") {
      await api(`/fixed-expenses/${id}`, { method: "DELETE" });
      loadFixed();
      loadSummary();
    }
    if (action === "delete-income") {
      await api(`/incomes/${id}`, { method: "DELETE" });
      loadIncome();
      loadSummary();
    }
  } catch (err) {
    setStatus(err.message);
  }
}

summaryBtn.addEventListener("click", loadSummary);
chartBtn.addEventListener("click", loadChart);
fixedLoad.addEventListener("click", loadFixed);
incomeLoad.addEventListener("click", loadIncome);
loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);
logoutBtn.addEventListener("click", handleLogout);
changePasswordForm.addEventListener("submit", handleChangePassword);
deleteAccountForm.addEventListener("submit", handleDeleteAccount);
fixedForm.addEventListener("submit", handleFixedSubmit);
incomeForm.addEventListener("submit", handleIncomeSubmit);
fixedList.addEventListener("click", handleListClick);
incomeList.addEventListener("click", handleListClick);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

summaryMonth.value = monthValue();
chartMonth.value = monthValue();
fixedMonth.value = monthValue();
incomeMonth.value = monthValue();

loadProfile();

userMenuBtn.addEventListener("click", () => {
  userMenuPanel.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  if (!userMenuPanel.classList.contains("hidden")) {
    const isInside = event.target.closest(".user-menu");
    if (!isInside) {
      userMenuPanel.classList.add("hidden");
    }
  }
});

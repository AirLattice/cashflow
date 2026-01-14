const authStatus = document.getElementById("auth-status");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutBtn = document.getElementById("logout-btn");
const authPanel = document.getElementById("auth-panel");
const userMenuBtn = document.getElementById("user-menu-btn");
const userMenuPanel = document.getElementById("user-menu-panel");
const changePasswordForm = document.getElementById("change-password-form");
const deleteAccountForm = document.getElementById("delete-account-form");
const summaryBtn = document.getElementById("summary-btn");
const summaryMonth = document.getElementById("summary-month");
const summaryIncome = document.getElementById("summary-income");
const summaryExpenses = document.getElementById("summary-expenses");
const summaryBalance = document.getElementById("summary-balance");
const fixedForm = document.getElementById("fixed-form");
const fixedList = document.getElementById("fixed-list");
const fixedMonth = document.getElementById("fixed-month");
const fixedLoad = document.getElementById("fixed-load");
const incomeForm = document.getElementById("income-form");
const incomeList = document.getElementById("income-list");
const incomeMonth = document.getElementById("income-month");
const incomeLoad = document.getElementById("income-load");
const tabs = document.querySelectorAll(".tab");

const formatter = new Intl.NumberFormat("ko-KR");
let refreshInFlight = null;

function setStatus(message) {
  authStatus.textContent = message;
}

function setLoggedIn(isLoggedIn, username) {
  if (isLoggedIn) {
    setStatus("로그인됨");
    authPanel.classList.add("hidden");
    userMenuBtn.textContent = username || "내 계정";
    userMenuBtn.classList.remove("hidden");
  } else {
    setStatus("로그인 필요");
    authPanel.classList.remove("hidden");
    userMenuBtn.classList.add("hidden");
    userMenuPanel.classList.add("hidden");
  }
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
    setLoggedIn(true, data.username);
    sessionStorage.setItem("username", data.username);
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
      setLoggedIn(true, username);
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
    setLoggedIn(true, data.username);
  } catch (err) {
    setLoggedIn(false);
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

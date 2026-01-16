const statusEl = document.getElementById("transactions-status");
const transactionsBody = document.getElementById("transactions-body");
const transactionsEmpty = document.getElementById("transactions-empty");
const transactionForm = document.getElementById("transaction-form");
const assetSelect = document.getElementById("asset-select");
const filterForm = document.getElementById("filter-form");
const filterStart = document.getElementById("filter-start");
const filterEnd = document.getElementById("filter-end");
const toggleFormBtn = document.getElementById("toggle-transaction-form");

const formatter = new Intl.NumberFormat("ko-KR");
const { parseMoney, bindMoneyInputs } = window.FormUtils || {};
const assetTypeById = new Map();

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateInput(value) {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
}

function getDefaultRange(monthStartDay) {
  const startDay = Number(monthStartDay) || 1;
  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();
  if (now.getDate() < startDay) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }
  const start = new Date(year, monthIndex, startDay);
  const end = new Date(year, monthIndex + 1, startDay - 1);
  return { start, end };
}

async function api(path, options = {}) {
  const requestWithRefresh = window.ApiClient?.requestWithRefresh;
  const refreshSession = window.ApiClient?.refreshSession;
  if (!requestWithRefresh) {
    throw new Error("API client not available");
  }
  return requestWithRefresh(path, options, refreshSession, () => {
    throw new Error("로그인이 필요합니다.");
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function toNumber(value) {
  if (typeof parseMoney === "function") {
    return parseMoney(value);
  }
  const cleaned = String(value || "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function updateInstallmentFields(assetType) {
  const principalInput = transactionForm.querySelector("[name='principal_cents']");
  const installmentInput = transactionForm.querySelector("[name='installment_count']");
  const rateInput = transactionForm.querySelector("[name='interest_rate']");
  const needsDetail = assetType === "card" || assetType === "loan";

  [principalInput, installmentInput, rateInput].forEach((input) => {
    if (!input) {
      return;
    }
    input.required = needsDetail;
    input.disabled = !needsDetail;
    if (!needsDetail) {
      input.value = "";
    }
  });
}

function renderTransactions(items) {
  if (!items.length) {
    transactionsBody.innerHTML = "";
    transactionsEmpty.classList.remove("hidden");
    return;
  }
  transactionsEmpty.classList.add("hidden");
  const rows = items.map((item) => {
    const date = new Date(item.occurred_at || item.created_at);
    const dateLabel = Number.isNaN(date.getTime())
      ? "-"
      : date.toISOString().slice(0, 10);
    const directionLabel = item.direction === "deposit" ? "입금" : "출금";
    const amount = formatter.format(item.amount_cents || 0);
    return `
      <tr data-id="${item.id}">
        <td data-label="일시">${dateLabel}</td>
        <td data-label="자산">${item.asset_name || "-"}</td>
        <td data-label="구분">${directionLabel}</td>
        <td data-label="금액">${amount}원</td>
        <td data-label="작성자">${item.username || "-"}</td>
        <td><button class="ghost" data-action="delete">삭제</button></td>
      </tr>
    `;
  });
  transactionsBody.innerHTML = rows.join("");
}

async function loadTransactions() {
  try {
    const start = filterStart?.value;
    const end = filterEnd?.value;
    if (!start || !end) {
      setStatus("조회 기간을 입력해주세요.");
      return;
    }
    if (new Date(start) > new Date(end)) {
      setStatus("종료일이 시작일보다 빠릅니다.");
      return;
    }
    const data = await api(`/transactions?start_date=${start}&end_date=${end}`);
    renderTransactions(data.items || []);
    setStatus("입출금 내역");
  } catch (err) {
    setStatus(err.message);
  }
}

async function loadAssets() {
  const data = await api("/assets");
  const items = data.items || [];
  assetTypeById.clear();
  if (!items.length) {
    assetSelect.innerHTML = "";
    setStatus("자산을 먼저 등록해주세요.");
    transactionForm.querySelector("button[type='submit']")?.setAttribute("disabled", "disabled");
    return;
  }
  const options = items.map((item, index) => {
    assetTypeById.set(String(item.id), item.asset_type);
    return `<option value="${item.id}" ${index === 0 ? "selected" : ""}>${item.name}</option>`;
  });
  assetSelect.innerHTML = options.join("");
  transactionForm.querySelector("button[type='submit']")?.removeAttribute("disabled");
  updateInstallmentFields(assetTypeById.get(String(assetSelect.value)));
}

assetSelect.addEventListener("change", () => {
  updateInstallmentFields(assetTypeById.get(String(assetSelect.value)));
});

transactionsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='delete']");
  if (!button) {
    return;
  }
  const row = button.closest("tr");
  if (!row) {
    return;
  }
  const id = row.dataset.id;
  if (!window.confirm("이 입출금 내역을 삭제하시겠습니까?")) {
    return;
  }
  try {
    await api(`/transactions/${id}`, { method: "DELETE" });
    setStatus("삭제 완료");
    await loadTransactions();
  } catch (err) {
    setStatus(err.message);
  }
});

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(transactionForm));
  const assetId = data.asset_id;
  const assetType = assetTypeById.get(String(assetId));
  const payload = {
    asset_id: assetId ? Number(assetId) : null,
    direction: data.direction,
    amount_cents: toNumber(data.amount_cents),
    principal_cents: toNumber(data.principal_cents),
    installment_count: data.installment_count ? Number(data.installment_count) : null,
    interest_rate: data.interest_rate ? Number(data.interest_rate) : null,
    memo: data.memo?.trim() || null
  };

  if (payload.amount_cents === null) {
    setStatus("금액을 입력해주세요.");
    return;
  }

  if ((assetType === "card" || assetType === "loan") &&
    (!Number.isFinite(payload.principal_cents) ||
      !Number.isFinite(payload.installment_count) ||
      !Number.isFinite(payload.interest_rate))) {
    setStatus("카드/대출은 원금, 분할 횟수, 이자율을 입력해야 합니다.");
    return;
  }

  try {
    await api("/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus("입출금 내역이 추가되었습니다.");
    transactionForm.reset();
    updateInstallmentFields(assetTypeById.get(String(assetSelect.value)));
    await loadTransactions();
  } catch (err) {
    setStatus(err.message);
  }
});

filterForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadTransactions();
});

toggleFormBtn?.addEventListener("click", () => {
  transactionForm.classList.toggle("hidden");
  if (transactionForm.classList.contains("hidden")) {
    toggleFormBtn.textContent = "내역 추가";
  } else {
    toggleFormBtn.textContent = "내역 추가 닫기";
  }
});

async function init() {
  try {
    const me = await api("/auth/me");
    const permissions = me.permissions || {};
    if (typeof window.initNav === "function") {
      window.initNav({
        permissions,
        role: me.role,
        isAuthenticated: true,
        username: me.username,
        activeGroupId: me.active_group_id
      });
    }
    if (!(me.role === "admin" || permissions.transactions)) {
      setStatus("입출금 권한이 없습니다.");
      transactionForm.classList.add("hidden");
      return;
    }
    if (typeof bindMoneyInputs === "function") {
      bindMoneyInputs(transactionForm);
    }
    if (filterStart && filterEnd) {
      const range = getDefaultRange(me.month_start_day || 1);
      filterStart.value = formatDateInput(range.start);
      filterEnd.value = formatDateInput(range.end);
    }
    await loadAssets();
    await loadTransactions();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

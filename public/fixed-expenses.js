const statusEl = document.getElementById("fixed-status");
const listEl = document.getElementById("fixed-list");
const createForm = document.getElementById("fixed-create-form");
const addToggleBtn = document.getElementById("fixed-add-toggle");
const selectAllCheckbox = document.getElementById("fixed-select-all");
const clearSelectionBtn = document.getElementById("fixed-clear-selection");
const deleteSelectedBtn = document.getElementById("fixed-delete-selected");

const formatter = new Intl.NumberFormat("ko-KR");
const { parseMoney, formatMoney, bindMoneyInputs } = window.FormUtils || {};
let refreshInFlight = null;
const itemsById = new Map();

function setStatus(message) {
  statusEl.textContent = message;
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
      throw new Error("로그인이 필요합니다.");
    }
  }

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      payload = { error: "요청 실패" };
    }
    throw new Error(payload.error || "요청 실패");
  }

  return response.json();
}

function toNumber(value) {
  if (typeof parseMoney === "function") {
    return parseMoney(value);
  }
  const cleaned = String(value || "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function setIfAuto(input, value) {
  if (!input || input.dataset.manual === "true") {
    return;
  }
  if (value === null || typeof value === "undefined") {
    input.value = "";
    return;
  }
  if (input.dataset.money === "true") {
    if (typeof formatMoney === "function") {
      input.value = formatMoney(value);
    } else {
      input.value = formatter.format(Math.max(0, Math.round(value)));
    }
    return;
  }
  input.value = String(Math.max(0, Math.round(value)));
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bindAutoFill() {
  if (!createForm) {
    return;
  }

  if (typeof bindMoneyInputs === "function") {
    bindMoneyInputs(createForm);
  }
  const monthsInput = createForm.querySelector("input[name='installments_count']");
  const rateInput = createForm.querySelector("input[name='interest_rate']");
  const paymentInput = createForm.querySelector("input[name='per_month_cents']");
  const startInput = createForm.querySelector("input[name='start_date']");
  const endInput = createForm.querySelector("input[name='end_date']");
  const totalInput = createForm.querySelector("input[name='total_amount_cents']");
  const interestInput = createForm.querySelector("input[name='total_interest_cents']");
  const totalWithInterestInput = createForm.querySelector("input[name='total_with_interest_cents']");
  const remainingInput = createForm.querySelector("input[name='remaining_cents']");

  [totalInput, interestInput, totalWithInterestInput, remainingInput, endInput, paymentInput].forEach(
    (input) => {
      if (!input) {
        return;
      }
      input.addEventListener("input", () => {
        input.dataset.manual = "true";
      });
    }
  );

  if (typeof bindMoneyInputs !== "function") {
    const fallbackInputs = createForm.querySelectorAll("input[data-money='true']");
    fallbackInputs.forEach((input) => {
      input.addEventListener("blur", () => {
        const value = toNumber(input.value);
        if (value === null) {
          return;
        }
        input.value = formatter.format(Math.max(0, Math.round(value)));
      });
    });
  }

  function recalc() {
    const months = toNumber(monthsInput?.value) || 0;
    const rate = toNumber(rateInput?.value) || 0;
    const payment = toNumber(paymentInput?.value) || 0;
    let baseAmount = toNumber(totalInput?.value);
    if ((!baseAmount || baseAmount <= 0) && payment && months) {
      baseAmount = payment * months;
      setIfAuto(totalInput, baseAmount);
    }
    if (baseAmount && months > 0) {
      setIfAuto(paymentInput, baseAmount / months);
    }
    const totalInterest = baseAmount ? baseAmount * (rate / 100) : 0;
    const totalWithInterest = baseAmount ? baseAmount + totalInterest : 0;

  setIfAuto(interestInput, totalInterest);
  setIfAuto(totalWithInterestInput, totalWithInterest);
  if (!remainingInput?.dataset.manual) {
    setIfAuto(remainingInput, totalWithInterest);
  }

    if (startInput && endInput && startInput.value && months > 0 && endInput.dataset.manual !== "true") {
      const startDate = new Date(startInput.value);
      if (!Number.isNaN(startDate.getTime())) {
        const endDate = addMonths(startDate, months);
        endDate.setDate(endDate.getDate() - 1);
        endInput.value = formatDateInput(endDate);
      }
    }
  }

  [monthsInput, rateInput, paymentInput, startInput].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener("input", recalc);
  });
}

function renderItems(items) {
  itemsById.clear();
  if (!items.length) {
    listEl.innerHTML = "<p>등록된 고정 지출이 없습니다.</p>";
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      itemsById.set(String(item.id), item);
      return `
      <div class="card-row fixed-row" data-id="${item.id}">
        <div>
          <strong>${item.name}</strong>
          <small>구매금액 ${formatter.format(item.total_amount_cents)}원 · 월 ${formatter.format(
        item.per_month_cents
      )}원</small>
        </div>
        <label class="inline-field">
          <span>선택</span>
          <input type="checkbox" class="fixed-select" data-id="${item.id}" />
        </label>
        <label class="inline-field">
          <span>첫 결제일</span>
          <input type="date" name="start_date" value="${item.start_date}" data-field="start_date" required />
        </label>
        <label class="inline-field">
          <span>마지막 결제일</span>
          <input type="date" name="end_date" value="${item.end_date}" data-field="end_date" required />
        </label>
      </div>
    `;
    })
    .join("");
}

async function loadItems() {
  try {
    const data = await api("/fixed-expenses?all=1");
    renderItems(data.items || []);
    syncSelectAllState();
    setStatus("고정 지출 목록");
  } catch (err) {
    setStatus(err.message);
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
  }
}

function syncSelectAllState() {
  if (!selectAllCheckbox) {
    return;
  }
  const checks = listEl.querySelectorAll(".fixed-select");
  if (!checks.length) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  const checkedCount = Array.from(checks).filter((input) => input.checked).length;
  selectAllCheckbox.checked = checkedCount === checks.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

listEl.addEventListener("change", (event) => {
  if (event.target.classList.contains("fixed-select")) {
    syncSelectAllState();
  }
});

selectAllCheckbox?.addEventListener("change", () => {
  const checks = listEl.querySelectorAll(".fixed-select");
  checks.forEach((input) => {
    input.checked = selectAllCheckbox.checked;
  });
  syncSelectAllState();
});

clearSelectionBtn?.addEventListener("click", () => {
  const checks = listEl.querySelectorAll(".fixed-select");
  checks.forEach((input) => {
    input.checked = false;
  });
  syncSelectAllState();
});

deleteSelectedBtn?.addEventListener("click", async () => {
  const checked = Array.from(listEl.querySelectorAll(".fixed-select")).filter(
    (input) => input.checked
  );
  if (!checked.length) {
    setStatus("삭제할 항목을 선택해주세요.");
    return;
  }
  if (!window.confirm(`선택한 ${checked.length}개 항목을 삭제하시겠습니까?`)) {
    return;
  }
  try {
    for (const input of checked) {
      await api(`/fixed-expenses/${input.dataset.id}`, { method: "DELETE" });
    }
    setStatus("삭제 완료");
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
});

listEl.addEventListener("change", async (event) => {
  const input = event.target.closest("input[data-field]");
  if (!input) {
    return;
  }
  const row = input.closest(".fixed-row");
  if (!row) {
    return;
  }
  const id = row.dataset.id;
  const item = itemsById.get(id);
  if (!item) {
    return;
  }

  const startInput = row.querySelector("input[name='start_date']");
  const endInput = row.querySelector("input[name='end_date']");
  let startDate = startInput?.value;
  let endDate = endInput?.value;

  if (input.name === "start_date" && item.installments_count && startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      const end = addMonths(start, Number(item.installments_count));
      end.setDate(end.getDate() - 1);
      endDate = formatDateInput(end);
      if (endInput) {
        endInput.value = endDate;
      }
    }
  }

  if (!startDate || !endDate) {
    setStatus("첫 결제일과 마지막 결제일을 입력해주세요.");
    return;
  }
  if (startDate > endDate) {
    setStatus("첫 결제일이 마지막 결제일보다 늦을 수 없습니다.");
    return;
  }

  try {
    await api(`/fixed-expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: item.name,
        total_amount_cents: item.total_amount_cents,
        per_month_cents: item.per_month_cents,
        start_date: startDate,
        end_date: endDate,
        payment_type: item.payment_type,
        installments_count: item.installments_count,
        interest_rate: item.interest_rate,
        total_interest_cents: item.total_interest_cents,
        total_with_interest_cents: item.total_with_interest_cents,
        remaining_cents: item.remaining_cents
      })
    });
    setStatus("변경 사항이 저장되었습니다.");
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
});

createForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(createForm));
  const payload = {
    name: data.name?.trim(),
    payment_type: "installment",
    installments_count: toNumber(data.installments_count),
    interest_rate: data.interest_rate ? Number(data.interest_rate) : null,
    per_month_cents: toNumber(data.per_month_cents),
    start_date: data.start_date,
    end_date: data.end_date,
    total_amount_cents: toNumber(data.total_amount_cents),
    total_interest_cents: toNumber(data.total_interest_cents),
    total_with_interest_cents: toNumber(data.total_with_interest_cents),
    remaining_cents: toNumber(data.remaining_cents)
  };

  const months = payload.installments_count || 0;
  if (!payload.total_amount_cents && payload.per_month_cents && months) {
    payload.total_amount_cents = payload.per_month_cents * months;
  }
  if (!payload.per_month_cents && payload.total_amount_cents && months) {
    payload.per_month_cents = Math.round(payload.total_amount_cents / months);
  }

  try {
    await api("/fixed-expenses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus("고정 지출이 추가되었습니다.");
    createForm.reset();
    createForm
      .querySelectorAll("[data-manual]")
      .forEach((input) => delete input.dataset.manual);
    createForm.classList.add("hidden");
    if (addToggleBtn) {
      addToggleBtn.textContent = "추가";
    }
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
});

async function init() {
  try {
    const me = await api("/auth/me");
    const permissions = me.permissions || {};
    if (typeof window.initNav === "function") {
      window.initNav({ permissions, role: me.role, isAuthenticated: true });
    }
    if (!(me.role === "admin" || permissions.fixed_expenses)) {
      setStatus("고정 지출 권한이 없습니다.");
      return;
    }
    bindAutoFill();
    if (addToggleBtn && createForm) {
      addToggleBtn.addEventListener("click", () => {
        const willShow = createForm.classList.toggle("hidden");
        addToggleBtn.textContent = willShow ? "추가" : "추가 취소";
      });
    }
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

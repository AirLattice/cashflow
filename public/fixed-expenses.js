const statusEl = document.getElementById("fixed-status");
const listEl = document.getElementById("fixed-list");
const createForm = document.getElementById("fixed-create-form");

const formatter = new Intl.NumberFormat("ko-KR");
let refreshInFlight = null;
const itemsById = new Map();

function setStatus(message) {
  statusEl.textContent = message;
}

function paymentLabel(value) {
  if (value === "installments" || value === "installment") {
    return "할부";
  }
  if (value === "loan") {
    return "대출";
  }
  return "일시";
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
  const parsed = Number(value);
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

  const monthsInput = createForm.querySelector("input[name='installments_count']");
  const rateInput = createForm.querySelector("input[name='interest_rate']");
  const paymentInput = createForm.querySelector("input[name='per_month_cents']");
  const startInput = createForm.querySelector("input[name='start_date']");
  const endInput = createForm.querySelector("input[name='end_date']");
  const totalInput = createForm.querySelector("input[name='total_amount_cents']");
  const interestInput = createForm.querySelector("input[name='total_interest_cents']");
  const totalWithInterestInput = createForm.querySelector("input[name='total_with_interest_cents']");
  const remainingInput = createForm.querySelector("input[name='remaining_cents']");

  [totalInput, interestInput, totalWithInterestInput, remainingInput, endInput].forEach(
    (input) => {
      if (!input) {
        return;
      }
      input.addEventListener("input", () => {
        input.dataset.manual = "true";
      });
    }
  );

  function recalc() {
    const months = toNumber(monthsInput?.value) || 0;
    const rate = toNumber(rateInput?.value) || 0;
    const payment = toNumber(paymentInput?.value) || 0;
    const totalAmount = payment * months;
    const totalInterest = totalAmount * (rate / 100);
    const totalWithInterest = totalAmount + totalInterest;

    setIfAuto(totalInput, totalAmount);
    setIfAuto(interestInput, totalInterest);
    setIfAuto(totalWithInterestInput, totalWithInterest);
    setIfAuto(remainingInput, totalWithInterest);

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
          <small>총액 ${formatter.format(item.total_amount_cents)}원 · 월 ${formatter.format(
        item.per_month_cents
      )}원 · ${paymentLabel(item.payment_type)}</small>
        </div>
        <label class="inline-field">
          <span>시작일</span>
          <input type="date" name="start_date" value="${item.start_date}" required />
        </label>
        <label class="inline-field">
          <span>마지막 지출일</span>
          <input type="date" name="end_date" value="${item.end_date}" required />
        </label>
        <div class="row-actions">
          <button type="button" data-action="save">저장</button>
          <button type="button" class="ghost" data-action="delete">삭제</button>
        </div>
      </div>
    `;
    })
    .join("");
}

async function loadItems() {
  try {
    const data = await api("/fixed-expenses?all=1");
    renderItems(data.items || []);
    setStatus("고정 지출 목록");
  } catch (err) {
    setStatus(err.message);
  }
}

listEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const row = button.closest(".fixed-row");
  if (!row) {
    return;
  }
  const id = row.dataset.id;
  const item = itemsById.get(id);
  if (!item) {
    return;
  }

  const action = button.dataset.action;
  if (action === "delete") {
    if (!window.confirm("정말로 삭제하시겠습니까?")) {
      return;
    }
    try {
      await api(`/fixed-expenses/${id}`, { method: "DELETE" });
      setStatus("삭제 완료");
      await loadItems();
    } catch (err) {
      setStatus(err.message);
    }
    return;
  }

  if (action === "save") {
    const startInput = row.querySelector("input[name='start_date']");
    const endInput = row.querySelector("input[name='end_date']");
    const startDate = startInput?.value;
    const endDate = endInput?.value;

    if (!startDate || !endDate) {
      setStatus("시작일과 마지막 지출일을 입력해주세요.");
      return;
    }
    if (startDate > endDate) {
      setStatus("시작일이 마지막 지출일보다 늦을 수 없습니다.");
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
      setStatus("저장 완료");
      await loadItems();
    } catch (err) {
      setStatus(err.message);
    }
  }
});

createForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(createForm));
  const payload = {
    name: data.name?.trim(),
    payment_type: data.payment_type,
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
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
});

async function init() {
  try {
    const me = await api("/auth/me");
    const permissions = me.permissions || {};
    if (!(me.role === "admin" || permissions.fixed_expenses)) {
      setStatus("고정 지출 권한이 없습니다.");
      return;
    }
    bindAutoFill();
    await loadItems();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

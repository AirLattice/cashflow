const statusEl = document.getElementById("assets-status");
const assetsBody = document.getElementById("assets-body");
const assetsEmpty = document.getElementById("assets-empty");
const assetForm = document.getElementById("asset-form");

const formatter = new Intl.NumberFormat("ko-KR");
const { parseMoney, bindMoneyInputs } = window.FormUtils || {};

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

function renderAssets(items) {
  if (!items.length) {
    assetsBody.innerHTML = "";
    assetsEmpty.classList.remove("hidden");
    return;
  }
  assetsEmpty.classList.add("hidden");
  const rows = items.map((item) => {
    const typeLabel = {
      cash: "현금",
      account: "계좌",
      card: "카드",
      loan: "대출"
    }[item.asset_type] || item.asset_type;
    const balance = formatter.format(item.current_balance_cents || 0);
    const filterText = item.filter_text ? item.filter_text : "-";
    const statusLabel = item.hidden ? "비활성화" : "활성";
    if (item.hidden) {
      return `
        <tr data-id="${item.id}" data-hidden="1">
          <td data-label="자산명" colspan="5">${item.name}</td>
          <td data-label="상태" colspan="2">${statusLabel}</td>
          <td>
            <button class="ghost" data-action="toggle">활성화</button>
            <button class="ghost" data-action="delete">삭제</button>
          </td>
        </tr>
      `;
    }
    return `
      <tr data-id="${item.id}" data-hidden="${item.hidden ? "1" : "0"}">
        <td data-label="자산명">${item.name}</td>
        <td data-label="구분">${typeLabel}</td>
        <td data-label="발행기관">${item.issuer}</td>
        <td data-label="자산번호">${item.asset_number || "-"}</td>
        <td data-label="필터">${filterText}</td>
        <td data-label="상태">${statusLabel}</td>
        <td data-label="잔액">${balance}원</td>
        <td>
          <button class="ghost" data-action="toggle">${item.hidden ? "활성화" : "비활성화"}</button>
          <button class="ghost" data-action="delete">삭제</button>
        </td>
      </tr>
    `;
  });
  assetsBody.innerHTML = rows.join("");
}

async function loadAssets() {
  try {
    const data = await api("/assets?include_hidden=1");
    renderAssets(data.items || []);
    setStatus("자산 목록");
  } catch (err) {
    setStatus(err.message);
  }
}

assetsBody.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest("button[data-action='toggle']");
  if (toggleButton) {
    const row = toggleButton.closest("tr");
    if (!row) {
      return;
    }
    const id = row.dataset.id;
    const isHidden = row.dataset.hidden === "1";
    try {
      await api(`/assets/${id}/hidden`, {
        method: "PUT",
        body: JSON.stringify({ hidden: !isHidden })
      });
      setStatus(isHidden ? "자산 활성화됨" : "자산 비활성화됨");
      await loadAssets();
    } catch (err) {
      setStatus(err.message);
    }
    return;
  }

  const button = event.target.closest("button[data-action='delete']");
  if (!button) {
    return;
  }
  const row = button.closest("tr");
  if (!row) {
    return;
  }
  const id = row.dataset.id;
  if (!window.confirm("이 자산을 삭제하시겠습니까?")) {
    return;
  }
  try {
    await api(`/assets/${id}`, { method: "DELETE" });
    setStatus("삭제 완료");
    await loadAssets();
  } catch (err) {
    setStatus(err.message);
  }
});

assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(assetForm));
  const payload = {
    name: data.name?.trim(),
    issuer: data.issuer?.trim(),
    asset_number: data.asset_number?.trim() || null,
    filter_text: data.filter_text?.trim() || null,
    asset_type: data.asset_type,
    current_balance_cents: toNumber(data.current_balance_cents)
  };
  if (payload.current_balance_cents === null) {
    setStatus("현재 잔액을 입력해주세요.");
    return;
  }
  try {
    await api("/assets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setStatus("자산이 추가되었습니다.");
    assetForm.reset();
    await loadAssets();
  } catch (err) {
    setStatus(err.message);
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
    if (!(me.role === "admin" || permissions.assets)) {
      setStatus("자산 권한이 없습니다.");
      return;
    }
    if (typeof bindMoneyInputs === "function") {
      bindMoneyInputs(assetForm);
    }
    await loadAssets();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

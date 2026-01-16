const statusEl = document.getElementById("unmatched-status");
const bodyEl = document.getElementById("unmatched-body");
const emptyEl = document.getElementById("unmatched-empty");
const previewEl = document.getElementById("unmatched-preview");
const filterForm = document.getElementById("filter-form");
const filterAssetSelect = document.getElementById("filter-asset-select");
const filterTextInput = document.getElementById("filter-text");
const createForm = document.getElementById("create-form");

const { parseMoney, bindMoneyInputs } = window.FormUtils || {};
let selectedLogId = null;
const assetFilterMap = new Map();

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
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

function toNumber(value) {
  if (typeof parseMoney === "function") {
    return parseMoney(value);
  }
  const cleaned = String(value || "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function renderLogs(items) {
  if (!items.length) {
    bodyEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  const rows = items.map((item) => {
    const received = item.received_at
      ? item.received_at.replace("T", " ").replace("Z", "")
      : "-";
    return `
      <tr data-id="${item.id}" data-text="${encodeURIComponent(item.text || "")}">
        <td data-label="수신시간">${received}</td>
        <td data-label="내용">${item.text_preview || "-"}</td>
        <td><button class="ghost" data-action="select">선택</button></td>
        <td><button class="ghost" data-action="ignore">삭제</button></td>
      </tr>
    `;
  });
  bodyEl.innerHTML = rows.join("");
}

function setSelectedRow(row) {
  bodyEl.querySelectorAll("tr").forEach((entry) => {
    entry.classList.toggle("selected", entry === row);
  });
}

function updatePreview(text) {
  if (!previewEl) {
    return;
  }
  previewEl.textContent = text || "메시지를 선택해주세요.";
}

async function loadLogs() {
  const data = await api("/websms/unmatched");
  const items = data.items || [];
  renderLogs(items);
  setStatus(items.length ? "미분류 메시지" : "미분류 메시지가 없습니다.");
}

async function loadAssets() {
  const data = await api("/assets");
  const items = data.items || [];
  assetFilterMap.clear();
  if (!items.length) {
    filterAssetSelect.innerHTML = "";
    filterAssetSelect.disabled = true;
    return;
  }
  filterAssetSelect.disabled = false;
  filterAssetSelect.innerHTML = items
    .map((item, index) => {
      assetFilterMap.set(String(item.id), item.filter_text || "");
      return `<option value="${item.id}" ${index === 0 ? "selected" : ""}>${item.name}</option>`;
    })
    .join("");
  const selectedId = filterAssetSelect.value;
  filterTextInput.value = assetFilterMap.get(String(selectedId)) || "";
}

bodyEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='select']");
  if (button) {
    const row = button.closest("tr");
    if (!row) {
      return;
    }
    selectedLogId = Number(row.dataset.id);
    const text = decodeURIComponent(row.dataset.text || "");
    setSelectedRow(row);
    updatePreview(text);
    return;
  }

  const ignoreButton = event.target.closest("button[data-action='ignore']");
  if (!ignoreButton) {
    return;
  }
  const row = ignoreButton.closest("tr");
  if (!row) {
    return;
  }
  const logId = Number(row.dataset.id);
  if (!logId) {
    return;
  }
  if (!window.confirm("이 미분류 메시지를 삭제 처리할까요?")) {
    return;
  }
  try {
    await api(`/websms/unmatched/${logId}/ignore`, { method: "POST" });
    setStatus("미분류 메시지가 삭제 처리되었습니다.");
    if (selectedLogId === logId) {
      selectedLogId = null;
      updatePreview("");
    }
    await loadLogs();
  } catch (err) {
    setStatus(err.message);
  }
});

filterAssetSelect.addEventListener("change", () => {
  const selectedId = filterAssetSelect.value;
  filterTextInput.value = assetFilterMap.get(String(selectedId)) || "";
});

filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedLogId) {
    setStatus("메시지를 먼저 선택해주세요.");
    return;
  }
  const assetId = Number(filterAssetSelect.value);
  const filterText = filterTextInput.value.trim();
  if (!assetId) {
    setStatus("자산을 선택해주세요.");
    return;
  }
  try {
    await api(`/assets/${assetId}/filter`, {
      method: "PUT",
      body: JSON.stringify({ filter_text: filterText })
    });
    await api(`/websms/unmatched/${selectedLogId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ asset_id: assetId })
    });
    setStatus("미분류 메시지가 처리되었습니다.");
    filterTextInput.value = "";
    selectedLogId = null;
    updatePreview("");
    await loadAssets();
    await loadLogs();
  } catch (err) {
    setStatus(err.message);
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedLogId) {
    setStatus("메시지를 먼저 선택해주세요.");
    return;
  }
  const data = Object.fromEntries(new FormData(createForm));
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
    const result = await api("/assets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await api(`/websms/unmatched/${selectedLogId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ asset_id: result.item.id })
    });
    setStatus("자산이 추가되고 메시지가 처리되었습니다.");
    createForm.reset();
    selectedLogId = null;
    updatePreview("");
    await loadAssets();
    await loadLogs();
  } catch (err) {
    setStatus(err.message);
  }
});

async function init() {
  try {
    const me = await api("/auth/me");
    if (typeof window.initNav === "function") {
      window.initNav({
        permissions: me.permissions || {},
        role: me.role,
        isAuthenticated: true,
        username: me.username,
        activeGroupId: me.active_group_id
      });
    }
    if (typeof bindMoneyInputs === "function") {
      bindMoneyInputs(createForm);
    }
    await loadAssets();
    await loadLogs();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

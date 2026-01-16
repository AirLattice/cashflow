const statusEl = document.getElementById("websms-status");
const bodyEl = document.getElementById("websms-body");
const emptyEl = document.getElementById("websms-empty");
const deniedEl = document.getElementById("websms-denied");
const panelEl = document.getElementById("websms-panel");

async function api(path, options = {}) {
  const request = window.ApiClient?.request;
  if (!request) {
    throw new Error("API client not available");
  }
  return request(path, options);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function renderRows(items) {
  if (!items.length) {
    bodyEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  const rows = items.map((item) => {
    const received = item.received_at ? item.received_at.replace("T", " ").replace("Z", "") : "-";
    const statusLabel = item.status === "processed" ? "정상" : "미분류";
    return `
      <tr>
        <td data-label="수신시간">${received}</td>
        <td data-label="상태">${statusLabel}</td>
        <td data-label="내용">${item.text_preview || "-"}</td>
      </tr>
    `;
  });
  bodyEl.innerHTML = rows.join("");
}

async function loadLogs() {
  const data = await api("/admin/websms-logs");
  renderRows(data.items || []);
  setStatus("WebSMS 로그");
}

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
    if (me.role !== "admin") {
      deniedEl.classList.remove("hidden");
      panelEl.classList.add("hidden");
      return;
    }
    await loadLogs();
  } catch (err) {
    deniedEl.classList.remove("hidden");
    panelEl.classList.add("hidden");
    setStatus(err.message);
  }
}

init();

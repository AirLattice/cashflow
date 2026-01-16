const statusEl = document.getElementById("unmatched-status");
const bodyEl = document.getElementById("unmatched-body");
const emptyEl = document.getElementById("unmatched-empty");
const previewEl = document.getElementById("unmatched-preview");

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

bodyEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='select']");
  if (button) {
    const row = button.closest("tr");
    if (!row) {
      return;
    }
    const text = decodeURIComponent(row.dataset.text || "");
    updatePreview(text);
    bodyEl.querySelectorAll("tr").forEach((entry) => {
      entry.classList.toggle("selected", entry === row);
    });
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
  api(`/websms/unmatched/${logId}/ignore`, { method: "POST" })
    .then(() => {
      setStatus("미분류 메시지가 삭제 처리되었습니다.");
      if (row.classList.contains("selected")) {
        updatePreview("");
      }
      return loadLogs();
    })
    .catch((err) => {
      setStatus(err.message);
    });
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
    await loadLogs();
  } catch (err) {
    setStatus(err.message);
  }
}

init();

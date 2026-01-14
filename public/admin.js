const statusEl = document.getElementById("admin-status");
const tableEl = document.getElementById("admin-table");
const settingsForm = document.getElementById("settings-form");
const monthStartDayInput = document.getElementById("month-start-day");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include"
  });

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

function setStatus(message) {
  statusEl.textContent = message;
}

function renderUsers(users) {
  if (!users.length) {
    tableEl.innerHTML = "<p>등록된 사용자가 없습니다.</p>";
    return;
  }

  tableEl.innerHTML = users
    .map((user) => {
      const perms = user.permissions || {};
      return `
      <div class="card-row admin-row" data-user-id="${user.id}">
        <div>
          <strong>${user.username}</strong>
          <small>역할: ${user.role}</small>
        </div>
        <div class="admin-controls">
          <label><input type="checkbox" data-perm="fixed_expenses" ${
            perms.fixed_expenses ? "checked" : ""
          } /> 고정지출</label>
          <label><input type="checkbox" data-perm="incomes" ${
            perms.incomes ? "checked" : ""
          } /> 수입</label>
          <label><input type="checkbox" data-perm="summary" ${
            perms.summary ? "checked" : ""
          } /> 요약</label>
        </div>
        <div class="admin-controls">
          <select data-role>
            <option value="user" ${user.role === "user" ? "selected" : ""}>사용자</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>관리자</option>
          </select>
          <button class="ghost" data-action="save">저장</button>
        </div>
      </div>
    `;
    })
    .join("");
}

async function loadUsers() {
  try {
    const data = await api("/admin/users");
    renderUsers(data.users);
    setStatus("사용자 목록");
  } catch (err) {
    setStatus(err.message);
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
  }
}

async function loadSettings() {
  try {
    const data = await api("/admin/settings");
    monthStartDayInput.value = data.month_start_day || 1;
  } catch (err) {
    setStatus(err.message);
  }
}

async function init() {
  try {
    const me = await api("/auth/me");
    if (typeof window.initNav === "function") {
      window.initNav({ permissions: me.permissions || {}, role: me.role, isAuthenticated: true });
    }
    if (me.role !== "admin") {
      setStatus("관리자만 접근할 수 있습니다.");
      return;
    }
    await loadSettings();
    await loadUsers();
  } catch (err) {
    setStatus(err.message);
  }
}

tableEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='save']");
  if (!button) {
    return;
  }
  const row = button.closest(".admin-row");
  const userId = row.dataset.userId;
  const perms = {
    can_view_fixed_expenses: row.querySelector("input[data-perm='fixed_expenses']").checked,
    can_view_incomes: row.querySelector("input[data-perm='incomes']").checked,
    can_view_summary: row.querySelector("input[data-perm='summary']").checked
  };
  const role = row.querySelector("select[data-role]").value;
  try {
    await api(`/admin/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ role, ...perms })
    });
    setStatus("저장 완료");
  } catch (err) {
    setStatus(err.message);
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = Number(monthStartDayInput.value);
  try {
    await api("/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ month_start_day: value })
    });
    setStatus("월 기준이 저장되었습니다.");
  } catch (err) {
    setStatus(err.message);
  }
});

init();

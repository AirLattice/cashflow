const statusEl = document.getElementById("admin-status");
const tableEl = document.getElementById("admin-table");
const settingsForm = document.getElementById("settings-form");
const monthStartDayInput = document.getElementById("month-start-day");
const adminPanel = document.getElementById("admin-panel");
const deniedPanel = document.getElementById("admin-denied");
const groupForm = document.getElementById("group-form");
const groupNameInput = document.getElementById("group-name");
let groupOptions = [];

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

function showDenied(message) {
  if (adminPanel) {
    adminPanel.classList.add("hidden");
  }
  if (deniedPanel) {
    deniedPanel.classList.remove("hidden");
  }
  setStatus(message || "관리자만 접근할 수 있습니다.");
}

function showAdmin() {
  if (adminPanel) {
    adminPanel.classList.remove("hidden");
  }
  if (deniedPanel) {
    deniedPanel.classList.add("hidden");
  }
}

function renderUsers(users) {
  if (!users.length) {
    tableEl.innerHTML = "<p>등록된 사용자가 없습니다.</p>";
    return;
  }

  const groupOptionsMarkup = (groupOptions.length
    ? groupOptions
    : [{ id: "", name: "그룹 없음" }]
  )
    .map((group) => `<option value="${group.id}">${group.name}</option>`)
    .join("");

  tableEl.innerHTML = users
    .map((user) => {
      const perms = user.permissions || {};
      return `
      <div class="card-row admin-row" data-user-id="${user.id}">
        <div>
          <div class="admin-identity">
            <label class="admin-group">
              <select data-group-id>
                ${groupOptionsMarkup}
              </select>
            </label>
            <strong>${user.username}</strong>
            <small>#${user.id}</small>
          </div>
          <small>역할: ${user.role}</small>
        </div>
        <div class="admin-controls">
          <label><input type="checkbox" data-perm="assets" ${
            perms.assets ? "checked" : ""
          } /> 자산</label>
          <label><input type="checkbox" data-perm="transactions" ${
            perms.transactions ? "checked" : ""
          } /> 입출금</label>
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

  tableEl.querySelectorAll(".admin-row").forEach((row) => {
    const select = row.querySelector("select[data-group-id]");
    const userId = row.dataset.userId;
    const user = users.find((entry) => String(entry.id) === String(userId));
    if (select && user && user.group_id) {
      select.value = String(user.group_id);
    }
  });
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

async function loadGroups() {
  try {
    const data = await api("/admin/groups");
    groupOptions = data.groups || [];
  } catch (err) {
    setStatus(err.message);
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
      window.initNav({
        permissions: me.permissions || {},
        role: me.role,
        isAuthenticated: true,
        username: me.username,
        activeGroupId: me.active_group_id
      });
    }
    if (me.role !== "admin") {
      showDenied("관리자만 접근할 수 있습니다.");
      return;
    }
    showAdmin();
    await loadGroups();
    await loadSettings();
    await loadUsers();
  } catch (err) {
    showDenied(err.message);
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
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
    can_view_assets: row.querySelector("input[data-perm='assets']").checked,
    can_view_transactions: row.querySelector("input[data-perm='transactions']").checked,
    can_view_summary: row.querySelector("input[data-perm='summary']").checked
  };
  const groupId = Number(row.querySelector("select[data-group-id]")?.value);
  const role = row.querySelector("select[data-role]").value;
  try {
    await api(`/admin/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ role, group_id: groupId, ...perms })
    });
    setStatus("저장 완료");
  } catch (err) {
    setStatus(err.message);
  }
});

tableEl.addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-group-id]");
  if (!select) {
    return;
  }
  const row = select.closest(".admin-row");
  if (!row) {
    return;
  }
  const userId = row.dataset.userId;
  const perms = {
    can_view_assets: row.querySelector("input[data-perm='assets']").checked,
    can_view_transactions: row.querySelector("input[data-perm='transactions']").checked,
    can_view_summary: row.querySelector("input[data-perm='summary']").checked
  };
  const role = row.querySelector("select[data-role]").value;
  const groupId = Number(select.value);
  try {
    await api(`/admin/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ role, group_id: groupId, ...perms })
    });
    setStatus("데이터 그룹이 변경되었습니다.");
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

groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = groupNameInput.value.trim();
  if (!name) {
    setStatus("그룹 이름을 입력해주세요.");
    return;
  }
  try {
    await api("/admin/groups", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setStatus("그룹이 추가되었습니다.");
    groupNameInput.value = "";
    await loadGroups();
    await loadUsers();
  } catch (err) {
    setStatus(err.message);
  }
});

init();

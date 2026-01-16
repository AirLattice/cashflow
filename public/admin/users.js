const statusEl = document.getElementById("admin-status");
const tableEl = document.getElementById("admin-users-table");
const adminPanel = document.getElementById("admin-panel");
const deniedPanel = document.getElementById("admin-denied");

let groupOptions = [];
let usersCache = [];

function getSelectedGroupIds(row) {
  const values = Array.from(row.querySelectorAll("input[data-group-option]:checked"))
    .map((input) => Number(input.value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return values;
}

function updateGroupToggleText(row) {
  const toggle = row.querySelector("button[data-group-toggle]");
  if (!toggle) {
    return;
  }
  const selected = getSelectedGroupIds(row);
  toggle.textContent = selected.length
    ? `그룹 ${selected.length}개 선택`
    : "그룹 선택";
}

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function showDenied(message) {
  adminPanel?.classList.add("hidden");
  deniedPanel?.classList.remove("hidden");
  setStatus(message || "관리자만 접근할 수 있습니다.");
}

function showAdmin() {
  adminPanel?.classList.remove("hidden");
  deniedPanel?.classList.add("hidden");
}

function renderUsers(users) {
  if (!tableEl) {
    return;
  }
  if (!users.length) {
    tableEl.innerHTML = "<p>등록된 사용자가 없습니다.</p>";
    return;
  }

  tableEl.innerHTML = users
    .map((user) => {
      const groupIds = (user.group_ids && user.group_ids.length
        ? user.group_ids
        : user.group_id
          ? [user.group_id]
          : []
      ).map((id) => String(id));
      const groupOptionsMarkup = (groupOptions.length ? groupOptions : [])
        .map((group) => {
          const checked = groupIds.includes(String(group.id)) ? "checked" : "";
          return `
            <label class="group-option">
              <input type="checkbox" data-group-option value="${group.id}" ${checked} />
              <span>${group.name}</span>
            </label>
          `;
        })
        .join("");
      return `
        <div class="card-row admin-row" data-user-id="${user.id}">
          <div>
            <div class="admin-identity">
              <label class="admin-group">
                <div class="group-dropdown" data-group-dropdown>
                  <button type="button" class="ghost" data-group-toggle>그룹 선택</button>
                  <div class="group-menu hidden" data-group-menu>
                    ${groupOptionsMarkup || "<p class=\"hint\">그룹이 없습니다.</p>"}
                  </div>
                </div>
              </label>
              <strong>${user.username}</strong>
              <small>#${user.id}</small>
            </div>
            <small>역할: ${user.role}</small>
          </div>
          <div class="admin-controls">
            <select data-role>
              <option value="user" ${user.role === "user" ? "selected" : ""}>
                사용자
              </option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>
                관리자
              </option>
            </select>
            <button class="ghost" data-action="save">저장</button>
          </div>
        </div>
      `;
    })
    .join("");

  tableEl.querySelectorAll(".admin-row").forEach((row) => {
    const userId = row.dataset.userId;
    const user = users.find((entry) => String(entry.id) === String(userId));
    if (!user) {
      return;
    }
    const currentGroupIds = (user.group_ids && user.group_ids.length
      ? user.group_ids
      : user.group_id
        ? [user.group_id]
        : []
    ).map((id) => String(id));
    row.dataset.groupIds = JSON.stringify(currentGroupIds);
    updateGroupToggleText(row);
  });
}

async function loadGroups() {
  const api = window.AdminCommon?.api;
  try {
    const data = await api("/admin/groups");
    groupOptions = data.groups || [];
  } catch (err) {
    setStatus(err.message);
  }
}

async function loadUsers() {
  const api = window.AdminCommon?.api;
  try {
    const data = await api("/admin/users");
    usersCache = data.users || [];
    renderUsers(usersCache);
    setStatus("사용자 목록");
  } catch (err) {
    setStatus(err.message);
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
  }
}

async function init() {
  try {
    const requireAdmin = window.AdminCommon?.requireAdmin;
    await requireAdmin();
    showAdmin();
    await loadGroups();
    await loadUsers();
  } catch (err) {
    showDenied(err.message);
    window.initNav?.({ isAuthenticated: false });
  }
}

tableEl?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='save']");
  if (!button) {
    return;
  }
  const row = button.closest(".admin-row");
  const userId = row.dataset.userId;
  const role = row.querySelector("select[data-role]").value;
  const selected = getSelectedGroupIds(row);
  if (!selected.length) {
    setStatus("최소 하나의 그룹을 선택해야 합니다.");
    return;
  }
  const payload = { role, group_ids: selected };
  try {
    const api = window.AdminCommon?.api;
    await api(`/admin/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setStatus("저장 완료");
  } catch (err) {
    setStatus(err.message);
  }
});

tableEl?.addEventListener("click", (event) => {
  const toggle = event.target.closest("button[data-group-toggle]");
  if (!toggle) {
    return;
  }
  const dropdown = toggle.closest("[data-group-dropdown]");
  const menu = dropdown?.querySelector("[data-group-menu]");
  if (!menu) {
    return;
  }
  document.querySelectorAll("[data-group-menu]").forEach((other) => {
    if (other !== menu) {
      other.classList.add("hidden");
    }
  });
  menu.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  const dropdown = event.target.closest("[data-group-dropdown]");
  if (dropdown) {
    return;
  }
  document.querySelectorAll("[data-group-menu]").forEach((menu) => {
    menu.classList.add("hidden");
  });
});

tableEl?.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("input[data-group-option]");
  if (!checkbox) {
    return;
  }
  const row = checkbox.closest(".admin-row");
  if (!row) {
    return;
  }
  const selected = getSelectedGroupIds(row);
  if (!selected.length) {
    setStatus("최소 하나의 그룹을 선택해야 합니다.");
    try {
      const previous = JSON.parse(row.dataset.groupIds || "[]");
      row.querySelectorAll("input[data-group-option]").forEach((input) => {
        input.checked = previous.includes(input.value);
      });
      updateGroupToggleText(row);
    } catch (err) {
      // ignore invalid stored data
    }
    return;
  }
  row.dataset.groupIds = JSON.stringify(selected.map(String));
  updateGroupToggleText(row);
  const userId = row.dataset.userId;
  const role = row.querySelector("select[data-role]").value;
  const payload = { role, group_ids: selected };
  try {
    const api = window.AdminCommon?.api;
    await api(`/admin/users/${userId}/permissions`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    setStatus("데이터 그룹이 변경되었습니다.");
  } catch (err) {
    setStatus(err.message);
  }
});

init();

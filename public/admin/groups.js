const statusEl = document.getElementById("admin-status");
const adminPanel = document.getElementById("admin-panel");
const deniedPanel = document.getElementById("admin-denied");
const groupForm = document.getElementById("group-form");
const groupNameInput = document.getElementById("group-name");
const groupListBody = document.getElementById("group-list-body");
const groupListEmpty = document.getElementById("group-list-empty");

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

function renderGroups(groups) {
  if (!groupListBody || !groupListEmpty) {
    return;
  }
  if (!groups.length) {
    groupListBody.innerHTML = "";
    groupListEmpty.classList.remove("hidden");
    return;
  }
  groupListEmpty.classList.add("hidden");
  groupListBody.innerHTML = groups
    .map(
      (group) => `
      <tr>
        <td data-label="ID">${group.id}</td>
        <td data-label="이름">${group.name}</td>
        <td data-label="월 시작일">
          <input
            type="number"
            min="1"
            max="28"
            data-group-start-day
            value="${group.month_start_day || 1}"
          />
        </td>
        <td>
          <button class="ghost" data-action="save" data-group-id="${group.id}">
            저장
          </button>
        </td>
      </tr>
    `
    )
    .join("");
}

async function loadGroups() {
  const api = window.AdminCommon?.api;
  try {
    const data = await api("/admin/groups");
    renderGroups(data.groups || []);
    setStatus("그룹 목록");
  } catch (err) {
    setStatus(err.message);
  }
}

async function init() {
  try {
    const requireAdmin = window.AdminCommon?.requireAdmin;
    await requireAdmin();
    showAdmin();
    await loadGroups();
  } catch (err) {
    showDenied(err.message);
    window.initNav?.({ isAuthenticated: false });
  }
}

groupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = groupNameInput?.value.trim();
  if (!name) {
    setStatus("그룹 이름을 입력해주세요.");
    return;
  }
  try {
    const api = window.AdminCommon?.api;
    await api("/admin/groups", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setStatus("그룹이 추가되었습니다.");
    groupNameInput.value = "";
    await loadGroups();
  } catch (err) {
    setStatus(err.message);
  }
});

groupListBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='save']");
  if (!button) {
    return;
  }
  const row = button.closest("tr");
  const input = row?.querySelector("input[data-group-start-day]");
  const groupId = Number(button.dataset.groupId);
  const value = Number(input?.value);
  if (!groupId) {
    setStatus("그룹 정보를 찾을 수 없습니다.");
    return;
  }
  if (!Number.isInteger(value) || value < 1 || value > 28) {
    setStatus("월 시작일은 1~28 사이여야 합니다.");
    return;
  }
  try {
    const api = window.AdminCommon?.api;
    await api(`/admin/groups/${groupId}/start-day`, {
      method: "PUT",
      body: JSON.stringify({ month_start_day: value })
    });
    setStatus("월 시작일이 변경되었습니다.");
    await loadGroups();
  } catch (err) {
    setStatus(err.message);
  }
});

init();

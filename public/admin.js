const statusEl = document.getElementById("admin-status");
const settingsForm = document.getElementById("settings-form");
const monthStartDayInput = document.getElementById("month-start-day");
const adminPanel = document.getElementById("admin-panel");
const deniedPanel = document.getElementById("admin-denied");

function setStatus(message) {
  statusEl.textContent = message;
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

async function loadSettings() {
  const api = window.AdminCommon?.api;
  try {
    const data = await api("/admin/settings");
    monthStartDayInput.value = data.month_start_day || 1;
  } catch (err) {
    setStatus(err.message);
  }
}

async function init() {
  try {
    const requireAdmin = window.AdminCommon?.requireAdmin;
    await requireAdmin();
    showAdmin();
    await loadSettings();
  } catch (err) {
    showDenied(err.message);
    window.initNav?.({ isAuthenticated: false });
  }
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const api = window.AdminCommon?.api;
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

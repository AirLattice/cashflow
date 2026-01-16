const statusEl = document.getElementById("admin-status");
const adminPanel = document.getElementById("admin-panel");
const deniedPanel = document.getElementById("admin-denied");

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
  setStatus("");
}

async function init() {
  try {
    const requireAdmin = window.AdminCommon?.requireAdmin;
    if (!requireAdmin) {
      throw new Error("API client not available");
    }
    await requireAdmin();
    showAdmin();
  } catch (err) {
    showDenied(err.message);
    window.initNav?.({ isAuthenticated: false });
  }
}

init();

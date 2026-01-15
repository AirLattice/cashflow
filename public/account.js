const authStatus = document.getElementById("auth-status");
const logoutBtn = document.getElementById("logout-btn");
const accountPanel = document.getElementById("account-panel");
const changePasswordForm = document.getElementById("change-password-form");
const deleteAccountForm = document.getElementById("delete-account-form");
const accountUser = document.getElementById("account-user");

let refreshInFlight = null;

function setStatus(message) {
  authStatus.textContent = message;
}

function setLoggedIn(isLoggedIn, username) {
  if (isLoggedIn) {
    setStatus("");
    logoutBtn.classList.remove("hidden");
    accountPanel.classList.remove("hidden");
    if (username) {
      accountUser.textContent = `아이디: ${username}`;
      accountUser.classList.remove("hidden");
    } else {
      accountUser.classList.add("hidden");
    }
  } else {
    setStatus("로그인 필요");
    logoutBtn.classList.add("hidden");
    accountPanel.classList.add("hidden");
    accountUser.classList.add("hidden");
  }
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  const response = await refreshInFlight;
  if (!response.ok) {
    throw new Error("refresh failed");
  }
}

async function api(path, options = {}) {
  const requestWithRefresh = window.ApiClient?.requestWithRefresh;
  if (!requestWithRefresh) {
    throw new Error("API client not available");
  }
  return requestWithRefresh(path, options, refreshSession, () => setLoggedIn(false));
}

async function handleLogout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (err) {
    setStatus(err.message);
  }
  sessionStorage.removeItem("username");
  setLoggedIn(false);
}

async function handleChangePassword(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(changePasswordForm));
  try {
    await api("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    const username = sessionStorage.getItem("username");
    if (username) {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: data.new_password })
      });
      setStatus("비밀번호가 변경되었습니다.");
      setLoggedIn(true, username);
    } else {
      setStatus("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      setLoggedIn(false);
    }
    changePasswordForm.reset();
  } catch (err) {
    setStatus(err.message);
  }
}

async function handleDeleteAccount(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(deleteAccountForm));
  if (!window.confirm("정말로 회원 탈퇴하시겠습니까?")) {
    return;
  }
  try {
    await api("/auth/delete-account", {
      method: "POST",
      body: JSON.stringify(data)
    });
    setStatus("회원 탈퇴가 완료되었습니다.");
    sessionStorage.removeItem("username");
    setLoggedIn(false);
    deleteAccountForm.reset();
  } catch (err) {
    setStatus(err.message);
  }
}

changePasswordForm.addEventListener("submit", handleChangePassword);
deleteAccountForm.addEventListener("submit", handleDeleteAccount);
logoutBtn.addEventListener("click", handleLogout);

api("/auth/me")
  .then((data) => {
    if (data.username) {
      sessionStorage.setItem("username", data.username);
    }
    setLoggedIn(true, data.username);
    if (typeof window.initNav === "function") {
      window.initNav({
        permissions: data.permissions || {},
        role: data.role,
        isAuthenticated: true,
        username: data.username,
        activeGroupId: data.active_group_id
      });
    }
  })
  .catch(() => {
    setLoggedIn(false);
    if (typeof window.initNav === "function") {
      window.initNav({ isAuthenticated: false });
    }
  });

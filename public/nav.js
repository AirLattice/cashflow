(() => {
  const root = document.getElementById("topbar-root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="topbar requires-auth">
      <div class="topbar-inner">
        <nav class="topbar-nav">
          <a class="ghost-link" href="/">홈</a>
          <a id="fixed-top-link" class="ghost-link" href="/fixed-expenses.html">고정지출</a>
          <a id="admin-top-link" class="ghost-link hidden" href="/admin">관리자</a>
        </nav>
        <div class="topbar-mobile">
          <button id="nav-menu-btn" class="ghost" type="button">메뉴</button>
          <div id="nav-menu-panel" class="menu-panel hidden">
            <a class="ghost-link" href="/">홈</a>
            <a id="fixed-mobile-link" class="ghost-link" href="/fixed-expenses.html">고정지출</a>
            <a id="admin-mobile-link" class="ghost-link hidden" href="/admin">관리자</a>
          </div>
        </div>
        <p id="auth-status" class="status hidden"></p>
        <div class="user-menu">
          <button id="user-menu-btn" class="ghost hidden" type="button">아이디</button>
          <div id="user-menu-panel" class="menu-panel hidden">
            <button id="change-password-toggle" class="ghost" type="button">비밀번호 변경</button>
            <form id="change-password-form" class="form hidden">
              <h3>비밀번호 변경</h3>
              <label>
                현재 비밀번호
                <input type="password" name="current_password" required />
              </label>
              <label>
                새 비밀번호
                <input type="password" name="new_password" required />
              </label>
              <button type="submit">비밀번호 변경</button>
              <p class="hint">비밀번호 정책: 영문/숫자/특수문자 포함 10자 이상</p>
            </form>
            <button id="delete-account-toggle" class="ghost" type="button">회원 탈퇴</button>
            <form id="delete-account-form" class="form hidden">
              <h3>회원 탈퇴</h3>
              <label>
                비밀번호 확인
                <input type="password" name="password" required />
              </label>
              <button type="submit" class="ghost">회원 탈퇴</button>
            </form>
            <a id="fixed-manage-link" class="ghost-link hidden" href="/fixed-expenses.html">고정 지출 관리</a>
            <a id="admin-link" class="ghost-link hidden" href="/admin">관리자 페이지</a>
            <button id="logout-btn" class="ghost" type="button">로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const navMenuBtn = document.getElementById("nav-menu-btn");
  const navMenuPanel = document.getElementById("nav-menu-panel");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const userMenuPanel = document.getElementById("user-menu-panel");
  const authStatus = document.getElementById("auth-status");
  const changePasswordToggle = document.getElementById("change-password-toggle");
  const deleteAccountToggle = document.getElementById("delete-account-toggle");
  const changePasswordForm = document.getElementById("change-password-form");
  const deleteAccountForm = document.getElementById("delete-account-form");
  const logoutBtn = document.getElementById("logout-btn");

  function bindNavMenu() {
    if (!navMenuBtn || !navMenuPanel) {
      return;
    }
    if (navMenuBtn.dataset.bound === "true") {
      return;
    }
    navMenuBtn.addEventListener("click", () => {
      navMenuPanel.classList.toggle("hidden");
    });
    navMenuPanel.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        navMenuPanel.classList.add("hidden");
      }
    });
    document.addEventListener("click", (event) => {
      if (!navMenuPanel.classList.contains("hidden")) {
        const isInside = event.target.closest(".topbar-mobile");
        if (!isInside) {
          navMenuPanel.classList.add("hidden");
        }
      }
    });
    navMenuBtn.dataset.bound = "true";
  }

  function bindUserMenu() {
    if (!userMenuBtn || !userMenuPanel) {
      return;
    }
    if (userMenuBtn.dataset.bound === "true") {
      return;
    }
    userMenuBtn.addEventListener("click", () => {
      userMenuPanel.classList.toggle("hidden");
    });
    document.addEventListener("click", (event) => {
      if (!userMenuPanel.classList.contains("hidden")) {
        const isInside = event.target.closest(".user-menu");
        if (!isInside) {
          userMenuPanel.classList.add("hidden");
        }
      }
    });
    userMenuBtn.dataset.bound = "true";
  }

  function bindUserMenuToggles() {
    if (!changePasswordToggle || !deleteAccountToggle) {
      return;
    }
    if (changePasswordToggle.dataset.bound === "true") {
      return;
    }

    changePasswordToggle.addEventListener("click", () => {
      changePasswordForm?.classList.toggle("hidden");
      deleteAccountForm?.classList.add("hidden");
    });
    deleteAccountToggle.addEventListener("click", () => {
      deleteAccountForm?.classList.toggle("hidden");
      changePasswordForm?.classList.add("hidden");
    });
    changePasswordToggle.dataset.bound = "true";
    deleteAccountToggle.dataset.bound = "true";
  }

  const api = window.ApiClient?.request || (async (path, options = {}) => {
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
  });

  function setStatus(message) {
    if (!authStatus) {
      return;
    }
    authStatus.textContent = message;
  }

  function bindUserActions() {
    if (changePasswordForm && changePasswordForm.dataset.bound !== "true") {
      changePasswordForm.addEventListener("submit", async (event) => {
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
          } else {
            setStatus("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
          }
          changePasswordForm.reset();
          userMenuPanel?.classList.add("hidden");
        } catch (err) {
          setStatus(err.message);
        }
      });
      changePasswordForm.dataset.bound = "true";
    }

    if (deleteAccountForm && deleteAccountForm.dataset.bound !== "true") {
      deleteAccountForm.addEventListener("submit", async (event) => {
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
          window.location.href = "/";
        } catch (err) {
          setStatus(err.message);
        }
      });
      deleteAccountForm.dataset.bound = "true";
    }

    if (logoutBtn && logoutBtn.dataset.bound !== "true") {
      logoutBtn.addEventListener("click", async () => {
        try {
          await api("/auth/logout", { method: "POST" });
        } catch (err) {
          setStatus(err.message);
        }
        sessionStorage.removeItem("username");
        window.location.href = "/";
      });
      logoutBtn.dataset.bound = "true";
    }
  }

  function applyPermissions(permissions, role, isAuthenticated) {
    const allowed = permissions || {};
    const isAdmin = role === "admin";
    const canFixed = isAdmin || Boolean(allowed.fixed_expenses);
    document.body.classList.toggle("is-authenticated", Boolean(isAuthenticated));

    const fixedTopLink = document.getElementById("fixed-top-link");
    const fixedMobileLink = document.getElementById("fixed-mobile-link");
    const adminTopLink = document.getElementById("admin-top-link");
    const adminMobileLink = document.getElementById("admin-mobile-link");

    if (!isAuthenticated) {
      fixedTopLink?.classList.add("hidden");
      fixedMobileLink?.classList.add("hidden");
      adminTopLink?.classList.add("hidden");
      adminMobileLink?.classList.add("hidden");
      navMenuPanel?.classList.add("hidden");
      userMenuPanel?.classList.add("hidden");
      userMenuBtn?.classList.add("hidden");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      return;
    }

    fixedTopLink?.classList.toggle("hidden", !canFixed);
    fixedMobileLink?.classList.toggle("hidden", !canFixed);
    adminTopLink?.classList.toggle("hidden", !isAdmin);
    adminMobileLink?.classList.toggle("hidden", !isAdmin);
    userMenuBtn?.classList.remove("hidden");
  }

  window.initNav = ({
    permissions = {},
    role = null,
    isAuthenticated = false,
    username = ""
  } = {}) => {
    applyPermissions(permissions, role, isAuthenticated);
    bindNavMenu();
    bindUserMenu();
    bindUserMenuToggles();
    bindUserActions();
    if (userMenuBtn && username) {
      userMenuBtn.textContent = username;
    }
  };
})();

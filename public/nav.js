(() => {
  const root = document.getElementById("topbar-root");
  if (!root) {
    return;
  }

  const includeUserMenu = root.dataset.userMenu === "true";

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
        ${
          includeUserMenu
            ? `
          <div class="user-menu">
            <button id="user-menu-btn" class="ghost hidden" type="button">아이디</button>
            <div id="user-menu-panel" class="menu-panel hidden">
              <form id="change-password-form" class="form">
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
              <form id="delete-account-form" class="form">
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
        `
            : ""
        }
      </div>
    </div>
  `;

  const navMenuBtn = document.getElementById("nav-menu-btn");
  const navMenuPanel = document.getElementById("nav-menu-panel");

  function bindNavMenu() {
    if (!navMenuBtn || !navMenuPanel) {
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
      return;
    }

    fixedTopLink?.classList.toggle("hidden", !canFixed);
    fixedMobileLink?.classList.toggle("hidden", !canFixed);
    adminTopLink?.classList.toggle("hidden", !isAdmin);
    adminMobileLink?.classList.toggle("hidden", !isAdmin);
  }

  window.initNav = ({ permissions = {}, role = null, isAuthenticated = false } = {}) => {
    applyPermissions(permissions, role, isAuthenticated);
    bindNavMenu();
  };
})();

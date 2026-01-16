(() => {
  async function api(path, options = {}) {
    const request = window.ApiClient?.request;
    if (!request) {
      throw new Error("API client not available");
    }
    return request(path, options);
  }

  async function requireAdmin() {
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
      throw new Error("관리자만 접근할 수 있습니다.");
    }
    return me;
  }

  window.AdminCommon = {
    api,
    requireAdmin
  };
})();

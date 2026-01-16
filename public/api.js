(() => {
  let refreshInFlight = null;

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

  async function request(path, options = {}) {
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

  async function requestWithRefresh(path, options = {}, refreshFn, onAuthFail) {
    if (options._retried) {
      return request(path, options);
    }

    try {
      return await request(path, options);
    } catch (err) {
      if (err.message === "missing access token") {
        const refreshHandler = refreshFn || refreshSession;
        if (refreshHandler) {
          try {
            await refreshHandler();
            return request(path, { ...options, _retried: true });
          } catch (refreshErr) {
            if (onAuthFail) {
              onAuthFail(refreshErr);
            }
          }
        }
      }
      throw err;
    }
  }

  window.ApiClient = {
    request,
    requestWithRefresh,
    refreshSession
  };
})();

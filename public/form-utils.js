(() => {
  const formatter = new Intl.NumberFormat("ko-KR");

  function parseMoney(value) {
    const cleaned = String(value || "").replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function formatMoney(value) {
    if (value === null || typeof value === "undefined" || Number.isNaN(value)) {
      return "";
    }
    return formatter.format(Math.max(0, Math.round(value)));
  }

  function bindMoneyInputs(root) {
    const scope = root || document;
    const moneyInputs = scope.querySelectorAll("input[data-money='true']");
    moneyInputs.forEach((input) => {
      input.addEventListener("blur", () => {
        const value = parseMoney(input.value);
        if (value === null) {
          return;
        }
        input.value = formatMoney(value);
      });
    });
  }

  window.FormUtils = {
    parseMoney,
    formatMoney,
    bindMoneyInputs
  };
})();

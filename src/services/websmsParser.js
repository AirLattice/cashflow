function strip(text) {
  return String(text || "").trim();
}

function parseAmount(raw) {
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : Math.abs(value);
}

function parseSamsung(text) {
  const headerMatch = text.match(/(?:삼성|\[삼성카드\])\s*(\d{4})\s*(승인|취소)/);
  if (!headerMatch) {
    return null;
  }
  const cardLast4 = headerMatch[1];
  const status = headerMatch[2] === "취소" ? "cancel" : "approve";

  const amountMatch = text.match(/(-?[\d,]+)원/);
  const amount = parseAmount(amountMatch ? amountMatch[1] : null);

  const installmentMatch = text.match(/(\d{1,2})개월|일시불/);
  const installments = installmentMatch
    ? installmentMatch[0] === "일시불"
      ? 1
      : Number(installmentMatch[1])
    : null;

  return {
    issuer: "삼성카드",
    card_last4: cardLast4,
    status,
    amount_cents: amount,
    installments
  };
}

function parseHyundai(text) {
  const headerMatch = text.match(/코스트코현대\s*(승인|취소)/);
  if (!headerMatch) {
    return null;
  }
  const status = headerMatch[1] === "취소" ? "cancel" : "approve";

  const amountMatch = text.match(/(-?[\d,]+)원/);
  const amount = parseAmount(amountMatch ? amountMatch[1] : null);

  const installmentMatch = text.match(/(\d{1,2})개월|일시불/);
  const installments = installmentMatch
    ? installmentMatch[0] === "일시불"
      ? 1
      : Number(installmentMatch[1])
    : null;

  return {
    issuer: "현대카드",
    card_last4: null,
    status,
    amount_cents: amount,
    installments
  };
}

function parseShinhan(text) {
  const headerMatch = text.match(/신한카드\((\d{4})\)(승인|취소)/);
  if (!headerMatch) {
    return null;
  }
  const cardLast4 = headerMatch[1];
  const status = headerMatch[2] === "취소" ? "cancel" : "approve";

  const amountMatch = text.match(/(-?[\d,]+)원/);
  const amount = parseAmount(amountMatch ? amountMatch[1] : null);

  const installmentMatch = text.match(/\((\d{1,2})개월\)|\(일시불\)/);
  const installments = installmentMatch
    ? installmentMatch[0] === "(일시불)"
      ? 1
      : Number(installmentMatch[1])
    : null;

  return {
    issuer: "신한카드",
    card_last4: cardLast4,
    status,
    amount_cents: amount,
    installments
  };
}

const parsers = [parseSamsung, parseHyundai, parseShinhan];

export function parseWebSms(text) {
  const normalized = strip(text);
  if (!normalized) {
    return null;
  }
  for (const parser of parsers) {
    const result = parser(normalized);
    if (result) {
      return result;
    }
  }
  return null;
}

import crypto from "crypto";

const fallbackKey = "websms_temp_1f4c9b7e0d2a4b7e9c1f";
const websmsApiKey = process.env.WEBSMS_API_KEY || fallbackKey;

function isValidKey(candidate) {
  if (!candidate) {
    return false;
  }
  const candidateBuf = Buffer.from(candidate);
  const keyBuf = Buffer.from(websmsApiKey);
  if (candidateBuf.length !== keyBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, keyBuf);
}

export function requireWebSmsApiKey(req, res, next) {
  const headerKey = req.get("x-api-key");
  const authHeader = req.get("authorization");
  let token = headerKey;

  if (!token && authHeader?.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!isValidKey(token)) {
    return res.status(401).json({ error: "invalid api key" });
  }

  return next();
}

export function getWebSmsApiKey() {
  return websmsApiKey;
}

export function isWebSmsFallbackKey() {
  return !process.env.WEBSMS_API_KEY;
}

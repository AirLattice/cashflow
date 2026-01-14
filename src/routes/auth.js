import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { getMonthStartDay } from "../utils/period.js";

function signAccessToken(userId) {
  return jwt.sign({}, process.env.JWT_ACCESS_SECRET, {
    subject: String(userId),
    expiresIn: "1h"
  });
}

function signRefreshToken(userId) {
  return jwt.sign({ jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    subject: String(userId),
    expiresIn: "7d"
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
}

function isStrongPassword(password) {
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return password.length >= 10 && hasLetter && hasNumber && hasSymbol;
}

export async function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  if (username.toLowerCase() === "admin") {
    return res.status(400).json({ error: "username is reserved" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: "password must be at least 10 chars and include letters, numbers, and symbols"
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const groupResult = await query(
      "select id from groups where name = 'family' limit 1"
    );
    const groupId = groupResult.rows[0]?.id;
    if (!groupId) {
      return res.status(500).json({ error: "group not initialized" });
    }
    const result = await query(
      "insert into users (username, password_hash, role, active_group_id) values ($1, $2, 'user', $3) returning id",
      [username, passwordHash, groupId]
    );
    await query("insert into user_permissions (user_id) values ($1)", [
      result.rows[0].id
    ]);
    await query(
      "insert into user_group_access (user_id, group_id) values ($1, $2) on conflict do nothing",
      [result.rows[0].id, groupId]
    );
    return res.status(201).json({ id: result.rows[0].id, username });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "username already exists" });
    }
    return res.status(500).json({ error: "failed to register" });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const result = await query(
    "select id, password_hash, active_group_id from users where username = $1",
    [username]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  if (user.active_group_id === null) {
    const groupResult = await query(
      "select id from groups where name = 'family' limit 1"
    );
    const groupId = groupResult.rows[0]?.id;
    if (groupId) {
      await query("update users set active_group_id = $1 where id = $2", [
        groupId,
        user.id
      ]);
      await query(
        "insert into user_group_access (user_id, group_id) values ($1, $2) on conflict do nothing",
        [user.id, groupId]
      );
    }
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  const refreshHash = hashToken(refreshToken);

  await query(
    "insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, now() + interval '7 days')",
    [user.id, refreshHash]
  );

  setAuthCookies(res, accessToken, refreshToken);
  return res.json({ ok: true });
}

export async function refresh(req, res) {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ error: "missing refresh token" });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "invalid or expired refresh token" });
  }

  const tokenHash = hashToken(refreshToken);
  const result = await query(
    "select id, revoked_at, expires_at from refresh_tokens where token_hash = $1",
    [tokenHash]
  );
  const tokenRow = result.rows[0];
  if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
    return res.status(401).json({ error: "refresh token revoked or expired" });
  }

  const accessToken = signAccessToken(payload.sub);
  setAuthCookies(res, accessToken, refreshToken);
  return res.json({ ok: true });
}

export async function logout(req, res) {
  const refreshToken = req.cookies.refresh_token;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await query("update refresh_tokens set revoked_at = now() where token_hash = $1", [
      tokenHash
    ]);
  }
  clearAuthCookies(res);
  return res.json({ ok: true });
}

export async function me(req, res) {
  const result = await query(
    "select u.id, u.username, u.role, u.active_group_id, g.name as group_name, p.can_view_fixed_expenses, p.can_view_incomes, p.can_view_summary from users u left join groups g on u.active_group_id = g.id left join user_permissions p on u.id = p.user_id where u.id = $1",
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const monthStartDay = await getMonthStartDay();
  return res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    active_group_id: user.active_group_id,
    group_name: user.group_name,
    permissions: {
      fixed_expenses: Boolean(user.can_view_fixed_expenses),
      incomes: Boolean(user.can_view_incomes),
      summary: Boolean(user.can_view_summary)
    },
    month_start_day: monthStartDay
  });
}

export async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "current_password and new_password required" });
  }

  if (!isStrongPassword(new_password)) {
    return res.status(400).json({
      error: "password must be at least 10 chars and include letters, numbers, and symbols"
    });
  }

  const result = await query("select password_hash from users where id = $1", [
    req.user.id
  ]);
  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }

  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const passwordHash = await bcrypt.hash(new_password, 12);
  await query("update users set password_hash = $1 where id = $2", [
    passwordHash,
    req.user.id
  ]);
  await query("update refresh_tokens set revoked_at = now() where user_id = $1", [
    req.user.id
  ]);
  clearAuthCookies(res);
  return res.json({ ok: true });
}

export async function deleteAccount(req, res) {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "password required" });
  }

  const result = await query("select password_hash from users where id = $1", [
    req.user.id
  ]);
  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  await query("delete from users where id = $1", [req.user.id]);
  clearAuthCookies(res);
  return res.json({ ok: true });
}

import { query } from "../db.js";

const ASSET_TYPES = new Set(["cash", "account", "card", "loan"]);

export async function listAssets(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const result = await query(
    "select * from assets where group_id = $1 order by id asc",
    [req.user.group_id]
  );
  return res.json({ items: result.rows });
}

export async function createAsset(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const {
    name,
    issuer,
    asset_number,
    asset_type,
    current_balance_cents
  } = req.body;

  if (!name || !issuer || !asset_type) {
    return res.status(400).json({ error: "missing required fields" });
  }
  if (!ASSET_TYPES.has(asset_type)) {
    return res.status(400).json({ error: "invalid asset_type" });
  }
  const balance = Number(current_balance_cents);
  if (!Number.isFinite(balance)) {
    return res.status(400).json({ error: "invalid current_balance_cents" });
  }

  const result = await query(
    "insert into assets (group_id, name, issuer, asset_number, asset_type, current_balance_cents) values ($1, $2, $3, $4, $5, $6) returning *",
    [req.user.group_id, name, issuer, asset_number || null, asset_type, balance]
  );

  return res.status(201).json({ item: result.rows[0] });
}

export async function updateAsset(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const {
    name,
    issuer,
    asset_number,
    asset_type,
    current_balance_cents
  } = req.body;

  if (!name || !issuer || !asset_type) {
    return res.status(400).json({ error: "missing required fields" });
  }
  if (!ASSET_TYPES.has(asset_type)) {
    return res.status(400).json({ error: "invalid asset_type" });
  }
  const balance = Number(current_balance_cents);
  if (!Number.isFinite(balance)) {
    return res.status(400).json({ error: "invalid current_balance_cents" });
  }

  const result = await query(
    "update assets set name = $1, issuer = $2, asset_number = $3, asset_type = $4, current_balance_cents = $5 where id = $6 and group_id = $7 returning *",
    [name, issuer, asset_number || null, asset_type, balance, req.params.id, req.user.group_id]
  );

  const item = result.rows[0];
  if (!item) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ item });
}

export async function deleteAsset(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }

  const usage = await query(
    "select 1 from transactions where asset_id = $1 limit 1",
    [req.params.id]
  );
  if (usage.rows.length) {
    return res.status(400).json({ error: "asset has transactions" });
  }

  const result = await query(
    "delete from assets where id = $1 and group_id = $2 returning id",
    [req.params.id, req.user.group_id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json({ ok: true });
}

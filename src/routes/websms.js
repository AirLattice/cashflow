import { getClient, query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";
import { parseWebSms } from "../services/websmsParser.js";

const WEB_SMS_LOG_LIMIT = 200;

export async function listWebSmsLogs(req, res) {
  const requestedGroupId = req.query.group_id ? Number(req.query.group_id) : null;
  const groupId = requestedGroupId || req.user.group_id;
  if (!groupId) {
    return res.json({ items: [] });
  }

  const monthStartDay = await getMonthStartDay(groupId);
  const period = getPeriodRange(monthStartDay);
  if (!period) {
    return res.status(400).json({ error: "invalid period" });
  }

  const result = await query(
    `select id, received_at, text_length, text_preview, text, status, asset_id
     from websms_logs
     where group_id = $1 and received_at >= $2 and received_at <= $3
     order by received_at desc
     limit $4`,
    [groupId, period.start, period.end, WEB_SMS_LOG_LIMIT]
  );
  return res.json({ items: result.rows });
}

export async function receiveWebSms(req, res) {
  const { text } = req.body;
  const receivedAt = new Date().toISOString();
  const content = String(text || "");
  const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;

  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  console.log(
    JSON.stringify({
      event: "websms_received",
      received_at: receivedAt,
      text_length: content.length,
      text_preview: preview
    })
  );

  const parsed = parseWebSms(content);
  let status = "unmatched";
  let assetId = null;
  let userId = null;
  let amount = null;
  let direction = null;
  let assetType = null;

  if (parsed?.issuer && req.websmsUserId) {
    const assetsResult = await query(
      "select a.id, a.group_id, a.asset_number, a.asset_type from assets a join user_group_access uga on uga.group_id = a.group_id where uga.user_id = $1 and a.issuer = $2 order by a.id asc",
      [req.websmsUserId, parsed.issuer]
    );
    const assets = assetsResult.rows;
    if (parsed.card_last4) {
      const match = assets.find((asset) => asset.asset_number === parsed.card_last4);
      if (match) {
        assetId = match.id;
        assetType = match.asset_type;
        req.websmsGroupId = match.group_id;
      }
    } else if (assets.length === 1) {
      assetId = assets[0].id;
      assetType = assets[0].asset_type;
      req.websmsGroupId = assets[0].group_id;
    }
  }

  if (assetId && Number.isFinite(parsed?.amount_cents)) {
    amount = Math.abs(parsed.amount_cents);
    direction = parsed.status === "cancel" ? "deposit" : "withdraw";
  }

  if (assetId && amount !== null) {
    userId = req.websmsUserId;
  }

  if (assetId && amount !== null && userId) {
    status = "processed";
  }

  const client = await getClient();
  try {
    await client.query("begin");

    let logGroupId = req.websmsGroupId;
    if (!logGroupId && req.websmsUserId) {
      const groupResult = await query(
        "select group_id from user_group_access where user_id = $1 order by created_at asc limit 1",
        [req.websmsUserId]
      );
      logGroupId = groupResult.rows[0]?.group_id || null;
    }
    if (!logGroupId) {
      throw new Error("group not resolved");
    }

    await client.query(
      "insert into websms_logs (group_id, asset_id, received_at, text_length, text_preview, text, status) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing",
      [logGroupId, assetId, receivedAt, content.length, preview, content, status]
    );

    if (status === "processed") {
      const delta = direction === "deposit" ? amount : -amount;
      const principal = assetType === "card" || assetType === "loan" ? amount : null;
      const installments =
        assetType === "card" || assetType === "loan" ? parsed.installments || 1 : null;
      const rate = assetType === "card" || assetType === "loan" ? 0 : null;

      await client.query(
        "insert into transactions (group_id, asset_id, user_id, direction, amount_cents, principal_cents, installment_count, interest_rate, memo, occurred_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [
          logGroupId,
          assetId,
          userId,
          direction,
          amount,
          principal,
          installments,
          rate,
          preview,
          receivedAt
        ]
      );

      await client.query(
        "update assets set current_balance_cents = current_balance_cents + $1 where id = $2 and group_id = $3",
        [delta, assetId, logGroupId]
      );
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return res.json({
    ok: true,
    received_at: receivedAt,
    text
  });
}

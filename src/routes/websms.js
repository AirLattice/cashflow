import { getClient, query } from "../db.js";
import { getMonthStartDay, getPeriodRange } from "../utils/period.js";

const WEB_SMS_LOG_LIMIT = 200;

export async function listUnmatchedWebSms(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const monthStartDay = await getMonthStartDay(req.user.group_id);
  const period = getPeriodRange(monthStartDay);
  if (!period) {
    return res.status(400).json({ error: "invalid period" });
  }

  const result = await query(
    `select id, received_at, text_preview, text
     from websms_logs
     where group_id = $1 and status = 'unmatched' and received_at >= $2 and received_at <= $3
     order by received_at desc
     limit $4`,
    [req.user.group_id, period.start, period.end, WEB_SMS_LOG_LIMIT]
  );
  return res.json({ items: result.rows });
}

export async function ignoreWebSmsLog(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const logId = Number(req.params.id);
  if (!logId) {
    return res.status(400).json({ error: "invalid log id" });
  }
  const result = await query(
    "update websms_logs set status = 'ignored' where id = $1 and group_id = $2 and status = 'unmatched' returning id",
    [logId, req.user.group_id]
  );
  if (!result.rowCount) {
    return res.status(404).json({ error: "not found" });
  }
  return res.json({ ok: true });
}

export async function resolveWebSmsLog(req, res) {
  if (!req.user.group_id) {
    return res.status(400).json({ error: "group not set" });
  }
  const logId = Number(req.params.id);
  const assetId = Number(req.body?.asset_id);
  if (!logId || !assetId) {
    return res.status(400).json({ error: "invalid request" });
  }

  const logResult = await query(
    "select id, received_at, text_preview, text from websms_logs where id = $1 and group_id = $2 and status = 'unmatched'",
    [logId, req.user.group_id]
  );
  const log = logResult.rows[0];
  if (!log) {
    return res.status(404).json({ error: "not found" });
  }

  const assetResult = await query(
    "select id, asset_type from assets where id = $1 and group_id = $2",
    [assetId, req.user.group_id]
  );
  const asset = assetResult.rows[0];
  if (!asset) {
    return res.status(404).json({ error: "asset not found" });
  }

  const parsed = parseGenericSms(log.text || "");
  if (!Number.isFinite(parsed?.amount_cents) || !parsed?.direction) {
    return res.status(400).json({ error: "unable to parse amount" });
  }

  const amount = Math.abs(parsed.amount_cents);
  const direction = parsed.direction;
  const delta = direction === "deposit" ? amount : -amount;
  const principal = asset.asset_type === "card" || asset.asset_type === "loan" ? amount : null;
  const installments = asset.asset_type === "card" || asset.asset_type === "loan" ? 1 : null;
  const rate = asset.asset_type === "card" || asset.asset_type === "loan" ? 0 : null;

  const client = await getClient();
  try {
    await client.query("begin");
    await client.query(
      "insert into transactions (group_id, asset_id, user_id, direction, amount_cents, principal_cents, installment_count, interest_rate, memo, occurred_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [
        req.user.group_id,
        assetId,
        req.user.id,
        direction,
        amount,
        principal,
        installments,
        rate,
        log.text_preview,
        log.received_at
      ]
    );
    await client.query(
      "update assets set current_balance_cents = current_balance_cents + $1 where id = $2 and group_id = $3",
      [delta, assetId, req.user.group_id]
    );
    await client.query(
      "update websms_logs set status = 'processed', asset_id = $1 where id = $2 and group_id = $3",
      [assetId, logId, req.user.group_id]
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return res.json({ ok: true });
}

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

  const parsed = parseGenericSms(content);
  let status = "unmatched";
  let assetId = null;
  let userId = null;
  let amount = null;
  let direction = null;
  let assetType = null;
  let resolvedGroupId = null;

  if (req.websmsUserId) {
    const assetsResult = await query(
      "select a.id, a.group_id, a.asset_type, a.filter_text from assets a join user_group_access uga on uga.group_id = a.group_id where uga.user_id = $1 and a.filter_text is not null and a.filter_text <> '' order by a.id asc",
      [req.websmsUserId]
    );
    const assets = assetsResult.rows;
    const matches = assets.filter((asset) => matchesFilter(content, asset.filter_text));
    if (matches.length === 1) {
      assetId = matches[0].id;
      assetType = matches[0].asset_type;
      resolvedGroupId = matches[0].group_id;
    }
  }

  if (assetId && Number.isFinite(parsed?.amount_cents) && parsed?.direction) {
    amount = Math.abs(parsed.amount_cents);
    direction = parsed.direction;
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

    let logGroupId = resolvedGroupId || req.websmsGroupId;
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
      const installments = assetType === "card" || assetType === "loan" ? 1 : null;
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

function matchesFilter(text, filterText) {
  if (!filterText) {
    return false;
  }
  const tokens = String(filterText)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) {
    return false;
  }
  return tokens.every((token) => text.includes(token));
}

function parseGenericSms(text) {
  const amountMatch = String(text).match(/(-?[\d,]+)원/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const normalized = String(text);
  let direction = null;
  if (normalized.includes("취소") || normalized.includes("입금")) {
    direction = "deposit";
  } else if (normalized.includes("출금") || normalized.includes("승인")) {
    direction = "withdraw";
  }
  return {
    amount_cents: Number.isNaN(amount) ? null : Math.abs(amount || 0),
    direction
  };
}

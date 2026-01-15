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

  return res.json({
    ok: true,
    received_at: receivedAt,
    text
  });
}

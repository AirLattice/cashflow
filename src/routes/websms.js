export async function receiveWebSms(req, res) {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  console.log("websms received", {
    received_at: new Date().toISOString(),
    text
  });

  return res.json({
    ok: true,
    received_at: new Date().toISOString(),
    text
  });
}

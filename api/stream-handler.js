import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Validate webhook source
  if (req.headers["x-moralis-signature"] !== process.env.MORALIS_STREAM_SECRET)
    return res.status(401).send("Unauthorized");

  const streamData = req.body;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  for (const tx of streamData.txs) {
    const wallet = tx.to || tx.from;

    // Lookup email in Supabase
    const { data } = await supabase
      .from("alerts")
      .select("email")
      .eq("wallet", wallet)
      .limit(1);

    if (data?.length > 0) {
      console.log("📨 Sending email to:", data[0].email);

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: data[0].email,
        subject: "🚀 New Crypto Transaction Detected",
        html: `
          <div style="font-family:Arial;background:#0f172a;padding:20px;color:white;border-radius:12px;">
            <h2 style="color:#0ef;">🔔 Transaction Alert</h2>
            <p>A new transaction occurred on your wallet:</p>
            <p><strong>${wallet}</strong></p>
            <p><strong>Hash:</strong> ${tx.hash}</p>
            <a href="https://etherscan.io/tx/${tx.hash}" 
              style="display:inline-block;margin-top:15px;padding:12px 20px;background:#0ef;color:black;font-weight:bold;border-radius:8px;text-decoration:none;">
              View Transaction
            </a>
          </div>
        `
      });
    }
  }

  res.status(200).send("OK");
}

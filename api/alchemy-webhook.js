import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Alchemy webhook endpoint active.");
  }

  try {
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const activities = data?.event?.activity || [];

    console.log("🚨 Incoming Webhook:", activities.length, "event(s)");

    for (const tx of activities) {
      const txHash = tx.hash;
      const from = tx.fromAddress?.toLowerCase();
      const to = tx.toAddress?.toLowerCase();

      const involvedWallets = [...new Set([from, to].filter(Boolean))];

      for (const wallet of involvedWallets) {
        const { data: existing } = await supabase
          .from("alerts")
          .select("email")
          .eq("wallet", wallet)
          .limit(1);

        if (!existing || existing.length === 0) continue;

        const email = existing[0].email;

        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: "🚀 New Transaction Alert",
          html: `
            <div style="font-family:Arial;background:#0f172a;padding:20px;border-radius:12px;color:white;">
              <h2 style="color:#00eaff;text-align:center;">🔔 Transaction Detected</h2>

              <p>Wallet:</p>
              <p style="word-break:break-all;font-weight:bold;">${wallet}</p>

              <p style="margin-top:10px;"><strong>Direction:</strong> ${wallet === from ? "Sent" : "Received"}</p>

              <p><strong>Transaction Hash:</strong></p>
              <p style="word-break:break-all;">${txHash}</p>

              <a href="https://etherscan.io/tx/${txHash}"
                style="display:block;margin:20px auto;padding:12px;background:#00eaff;color:black;
                width:max-content;text-decoration:none;border-radius:8px;font-weight:bold;">
                🔍 View on Etherscan
              </a>

              <p style="opacity:0.6;text-align:center;">Powered by CryptoHub Alerts</p>
            </div>
          `
        });

        console.log(`📧 Email sent to ${email} for wallet ${wallet}`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.status(200).send("OK");
  }
}

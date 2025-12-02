import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { wallet, email } = req.body;

    if (!wallet || !email) return res.status(400).send("Missing wallet or email");

    const normalizedWallet = wallet.toLowerCase();

    // Store or update in Supabase
    const { error } = await supabase.from("alerts").upsert(
      { wallet: normalizedWallet, email },
      { onConflict: "wallet" }
    );

    if (error) {
      console.error("Supabase Insert Error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ success: true, message: "Alerts enabled" });
  } catch (err) {
    console.error("Enable Alert Error:", err);
    return res.status(500).json({ error: "Internal Error" });
  }
}

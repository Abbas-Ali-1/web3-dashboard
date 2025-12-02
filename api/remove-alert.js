import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { wallet } = req.body;

    if (!wallet) return res.status(400).send("Missing wallet");

    const normalizedWallet = wallet.toLowerCase();

    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("wallet", normalizedWallet);

    if (error) {
      console.error("Supabase Delete Error:", error);
      return res.status(500).send("Database error");
    }

    return res.json({ success: true, message: "Alerts disabled" });
  } catch (err) {
    console.error("Remove Alert Error:", err);
    return res.status(500).send("Internal Error");
  }
}

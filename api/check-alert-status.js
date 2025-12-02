import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).send("Missing wallet");

  const normalizedWallet = wallet.toLowerCase();

  const { data, error } = await supabase
    .from("alerts")
    .select("email")
    .eq("wallet", normalizedWallet)
    .limit(1);

  if (error) {
    console.error("Supabase Query Error:", error);
    return res.json({ enabled: false, email: null });
  }

  if (!data || data.length === 0) {
    return res.json({ enabled: false, email: null });
  }

  return res.json({ enabled: true, email: data[0].email });
}

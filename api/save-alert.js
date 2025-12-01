import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { wallet, email } = req.body;

  if (!wallet || !email) return res.status(400).send("Missing fields");

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  // Save to DB
  await supabase.from("alerts").insert([{ wallet, email }]);

  // Add wallet to Moralis Stream
  await axios.post(
    "https://api.moralis-streams.com/api/v2/streams/add-address",
    {
      id: "YOUR_STREAM_ID", 
      address: wallet
    },
    {
      headers: { "x-api-key": process.env.MORALIS_STREAM_SECRET }
    }
  );

  res.json({ success: true, message: "Alerts enabled!" });
}

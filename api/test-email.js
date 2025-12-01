import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: req.query.to,
    subject: "Test Email",
    html: "<p>Email system works 🚀</p>"
  });

  res.json({ success: true });
}

// api/webhook-handler.js
// This receives webhooks from Alchemy when transactions occur

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Verify webhook signature from Alchemy
function verifySignature(body, signature, signingKey) {
  const hash = crypto
    .createHmac('sha256', signingKey)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

// Format value from wei to ETH
function formatEthValue(weiValue) {
  try {
    const eth = parseFloat(weiValue) / 1e18;
    return eth.toFixed(6);
  } catch {
    return '0';
  }
}

// Generate email HTML template
function generateEmailHTML(txData) {
  const {
    type,
    hash,
    fromAddress,
    toAddress,
    value,
    asset,
    timestamp,
    network
  } = txData;

  const etherscanUrl = network === 'MAINNET' 
    ? `https://etherscan.io/tx/${hash}`
    : `https://sepolia.etherscan.io/tx/${hash}`;

  const isIncoming = type === 'incoming';
  const emoji = isIncoming ? '📥' : '📤';
  const bgColor = isIncoming ? '#4dd2ff' : '#ff4d6d';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #0a0f24;
          color: #ffffff;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 30px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${bgColor}, ${bgColor}dd);
          padding: 20px;
          border-radius: 15px;
          margin-bottom: 25px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .info-row {
          background: rgba(255,255,255,0.05);
          padding: 15px;
          margin: 10px 0;
          border-radius: 10px;
          border-left: 4px solid ${bgColor};
        }
        .label {
          font-size: 12px;
          opacity: 0.7;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .value {
          font-size: 16px;
          font-weight: 600;
          word-break: break-all;
        }
        .amount {
          font-size: 32px;
          font-weight: 700;
          text-align: center;
          color: ${bgColor};
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: ${bgColor};
          color: #000;
          padding: 12px 30px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          margin-top: 20px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 12px;
          opacity: 0.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${emoji} ${isIncoming ? 'Incoming' : 'Outgoing'} Transaction</h1>
        </div>

        <div class="amount">
          ${value} ${asset}
        </div>

        <div class="info-row">
          <div class="label">From</div>
          <div class="value">${fromAddress}</div>
        </div>

        <div class="info-row">
          <div class="label">To</div>
          <div class="value">${toAddress}</div>
        </div>

        <div class="info-row">
          <div class="label">Transaction Hash</div>
          <div class="value">${hash}</div>
        </div>

        <div class="info-row">
          <div class="label">Time</div>
          <div class="value">${new Date(timestamp).toLocaleString()}</div>
        </div>

        <center>
          <a href="${etherscanUrl}" class="button" target="_blank">
            View on Etherscan →
          </a>
        </center>

        <div class="footer">
          <p>You're receiving this because you enabled transaction alerts for your wallet.</p>
          <p>CryptoHub Transaction Alert System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Main webhook handler
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Alchemy signature (optional but recommended)
    const signature = req.headers['x-alchemy-signature'];
    if (process.env.ALCHEMY_SIGNING_KEY && signature) {
      const isValid = verifySignature(
        req.body,
        signature,
        process.env.ALCHEMY_SIGNING_KEY
      );
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const webhookData = req.body;
    console.log('Received webhook:', JSON.stringify(webhookData, null, 2));

    // Extract activity data from Alchemy webhook
    const activity = webhookData.event?.activity?.[0];
    if (!activity) {
      console.log('No activity data in webhook');
      return res.status(200).json({ message: 'No activity to process' });
    }

    const {
      hash,
      fromAddress,
      toAddress,
      value,
      asset,
      category,
      network
    } = activity;

    // Determine if this is incoming or outgoing
    // Check both from and to addresses against our database
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('*')
      .or(`wallet_address.ilike.${fromAddress},wallet_address.ilike.${toAddress}`)
      .eq('notifications_enabled', true);

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!users || users.length === 0) {
      console.log('No monitored wallets involved in this transaction');
      return res.status(200).json({ message: 'No users to notify' });
    }

    // Check if we already sent alert for this transaction
    const { data: existingAlert } = await supabase
      .from('transaction_alerts')
      .select('*')
      .eq('transaction_hash', hash)
      .single();

    if (existingAlert) {
      console.log('Alert already sent for this transaction');
      return res.status(200).json({ message: 'Alert already sent' });
    }

    // Send emails to all involved users
    const emailPromises = users.map(async (user) => {
      const isIncoming = user.wallet_address.toLowerCase() === toAddress.toLowerCase();
      const txType = isIncoming ? 'incoming' : 'outgoing';

      const emailData = {
        type: txType,
        hash,
        fromAddress,
        toAddress,
        value: formatEthValue(value),
        asset: asset || 'ETH',
        timestamp: new Date().toISOString(),
        network: network || 'MAINNET'
      };

      try {
        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: 'CryptoHub Alerts <alerts@resend.dev>', // Change to your domain
          to: user.email,
          subject: `${isIncoming ? '📥 Incoming' : '📤 Outgoing'} Transaction Alert`,
          html: generateEmailHTML(emailData),
        });

        if (emailError) {
          console.error('Email error:', emailError);
          return null;
        }

        console.log('Email sent:', emailResult);

        // Store alert in database
        await supabase
          .from('transaction_alerts')
          .insert({
            wallet_address: user.wallet_address,
            transaction_hash: hash,
            from_address: fromAddress,
            to_address: toAddress,
            value: value,
          });

        return emailResult;
      } catch (error) {
        console.error('Error processing email:', error);
        return null;
      }
    });

    await Promise.all(emailPromises);

    return res.status(200).json({
      success: true,
      message: 'Alerts sent successfully',
      usersNotified: users.length
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
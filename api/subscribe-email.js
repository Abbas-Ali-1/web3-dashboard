// api/subscribe-email.js
// This API endpoint allows users to subscribe their email for transaction alerts

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Validate Ethereum address
function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate welcome email HTML
function generateWelcomeEmail(walletAddress) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          padding: 40px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #4dd2ff;
          font-size: 32px;
          margin: 0 0 10px 0;
        }
        .content {
          line-height: 1.8;
          font-size: 16px;
        }
        .wallet-box {
          background: rgba(77,210,255,0.1);
          border: 1px solid #4dd2ff;
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
          word-break: break-all;
          text-align: center;
          font-family: monospace;
        }
        .feature-list {
          background: rgba(255,255,255,0.05);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .feature-item {
          margin: 10px 0;
          padding-left: 25px;
          position: relative;
        }
        .feature-item:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #4dd2ff;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 14px;
          opacity: 0.7;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to CryptoHub Alerts!</h1>
          <p>Your transaction alerts are now active</p>
        </div>

        <div class="content">
          <p>Hi there!</p>
          <p>You've successfully enabled transaction alerts for your wallet:</p>

          <div class="wallet-box">
            ${walletAddress}
          </div>

          <div class="feature-list">
            <h3 style="margin-top: 0; color: #4dd2ff;">What you'll receive:</h3>
            <div class="feature-item">Instant email alerts for incoming transactions</div>
            <div class="feature-item">Notifications for outgoing transactions</div>
            <div class="feature-item">Transaction details including amount and addresses</div>
            <div class="feature-item">Direct links to view transactions on Etherscan</div>
            <div class="feature-item">Real-time monitoring 24/7</div>
          </div>

          <p>You'll receive an email every time your wallet sends or receives a transaction on the Ethereum network.</p>

          <p style="margin-top: 30px;">
            <strong>Need to manage your alerts?</strong><br>
            You can unsubscribe or update your preferences anytime from your dashboard.
          </p>
        </div>

        <div class="footer">
          <p>Thank you for using CryptoHub! 🚀</p>
          <p>Questions? Reply to this email anytime.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, email } = req.body;

    // Validate inputs
    if (!walletAddress || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both walletAddress and email are required'
      });
    }

    // Validate Ethereum address format
    if (!isValidEthAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: 'Please provide a valid Ethereum address (0x...)'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Normalize wallet address to lowercase
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if wallet already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', normalizedAddress)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Database check error:', checkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check existing subscription'
      });
    }

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          email: email,
          notifications_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', normalizedAddress)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({
          error: 'Failed to update subscription',
          message: updateError.message
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: {
          walletAddress: updatedUser.wallet_address,
          email: updatedUser.email,
          status: 'updated'
        }
      });
    }

    // Insert new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        wallet_address: normalizedAddress,
        email: email,
        notifications_enabled: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({
        error: 'Failed to create subscription',
        message: insertError.message
      });
    }

    // Send welcome email
    try {
      await resend.emails.send({
        from: 'CryptoHub Alerts <alerts@resend.dev>', // Change to your verified domain
        to: email,
        subject: '🎉 Welcome to CryptoHub Transaction Alerts!',
        html: generateWelcomeEmail(walletAddress),
      });
      console.log('Welcome email sent to:', email);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Subscription created successfully! Check your email.',
      data: {
        walletAddress: newUser.wallet_address,
        email: newUser.email,
        status: 'created'
      }
    });

  } catch (error) {
    console.error('Subscribe endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
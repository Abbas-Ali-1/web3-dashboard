// api/unsubscribe-email.js
// This API endpoint allows users to unsubscribe from transaction alerts

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Validate Ethereum address
function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
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
    const { walletAddress } = req.body;

    // Validate input
    if (!walletAddress) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'walletAddress is required'
      });
    }

    // Validate Ethereum address format
    if (!isValidEthAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: 'Please provide a valid Ethereum address (0x...)'
      });
    }

    // Normalize wallet address to lowercase
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', normalizedAddress)
      .single();

    if (checkError || !existingUser) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'No active subscription found for this wallet address'
      });
    }

    // Disable notifications instead of deleting (soft delete)
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        notifications_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', normalizedAddress)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({
        error: 'Failed to unsubscribe',
        message: updateError.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from transaction alerts',
      data: {
        walletAddress: updatedUser.wallet_address,
        email: updatedUser.email,
        status: 'unsubscribed'
      }
    });

  } catch (error) {
    console.error('Unsubscribe endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
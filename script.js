console.log("script.js loaded");

// Moralis API Key from environment variable
const MORALIS_API_KEY = process.env.REACT_APP_MORALIS_API_KEY;

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("myButton");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    console.log("✓ Logout button found");
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🔴 Logout button clicked!");
      logoutWallet();
    });
  }

  if (window.location.pathname.includes("dashboard.html")) {
    checkAuth();
  }
  
  if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
    const wallet = localStorage.getItem("wallet");
    if (wallet) {
      console.log("✓ User already connected, redirecting to dashboard");
      window.location.href = "dashboard.html";
    }
  }
});

/* ==========================================
      CHECK AUTHENTICATION
========================================== */
function checkAuth() {
  const wallet = localStorage.getItem("wallet");
  console.log("Checking auth - wallet:", wallet);
  
  if (!wallet) {
    console.log("❌ Not authenticated - redirecting to index");
    window.location.href = "index.html";
    return false;
  }
  
  loadDashboard();
  return true;
}

/* ==========================================
                CONNECT WALLET
========================================== */
async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask not found! Please install MetaMask.");
    return;
  }

  try {
    console.log("🔗 Connecting wallet...");
    const accounts = await window.ethereum.request({ 
      method: "eth_requestAccounts" 
    });
    
    const wallet = accounts[0];
    console.log("✓ Wallet connected:", wallet);
    localStorage.setItem("wallet", wallet);
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("❌ Connect wallet error:", err);
    if (err.code === 4001) {
      alert("You rejected the connection request.");
    } else {
      alert("Connection failed: " + err.message);
    }
  }
}

/* ==========================================
        NETWORK CONFIGURATION
========================================== */
const CHAIN_CONFIG = {
  mainnet: {
    chainId: "eth-mainnet",
    name: "Ethereum Mainnet",
    tokens: [
      "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
    ]
  },
  testnet: {
    sepolia: {
      chainId: "eth-sepolia",
      name: "Sepolia Testnet",
      tokens: [
        "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        "0x6f14C02576fCb6c51f3a200F4c7367fEe1e2fEfD"
      ]
    },
    mumbai: {
      chainId: "polygon-mumbai",
      name: "Mumbai Testnet",
      tokens: [
        "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        "0xe6b8a5CF3BF352Ca4C69273F805C5CDA601D746b",
        "0x2c89bae432a5ba5cb79e10df3d4f0b4603718562"
      ]
    }
  }
};

let currentNetwork = "mainnet";

/* ==========================================
   FETCH TRANSACTIONS FROM MORALIS
========================================== */
async function fetchTransactionsFromMoralis(wallet, chainId) {
  try {
    if (!MORALIS_API_KEY) {
      console.error("❌ Moralis API key not configured");
      return [];
    }

    const url = `https://deep-index.moralis.io/api/v2/${wallet}/erc20/transfers?chain=${chainId}&limit=500`;
    
    console.log(`📡 Fetching transactions from Moralis for ${chainId}...`);
    
    const response = await fetch(url, {
      headers: {
        "X-API-Key": MORALIS_API_KEY,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error(`❌ Moralis API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`✓ Fetched ${data.result?.length || 0} transactions`);
    return data.result || [];

  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    return [];
  }
}

/* ==========================================
   CALCULATE WEIGHTED AVERAGE PRICE
========================================== */
function calculateWeightedAverage(transactions) {
  if (!transactions || transactions.length === 0) {
    return { avgPrice: 0, totalAmount: 0, totalSpent: 0 };
  }

  let totalAmount = 0;
  let totalSpent = 0;

  transactions.forEach(tx => {
    const amount = parseFloat(tx.value) || 0;
    const price = parseFloat(tx.price_at_md5) || 0;
    
    totalAmount += amount;
    totalSpent += amount * price;
  });

  const avgPrice = totalAmount > 0 ? totalSpent / totalAmount : 0;

  return {
    avgPrice: avgPrice,
    totalAmount: totalAmount,
    totalSpent: totalSpent
  };
}

/* ==========================================
   GET CURRENT TOKEN PRICE
========================================== */
async function getTokenPrice(tokenAddress, chainType = "mainnet") {
  try {
    const chain = chainType === "mainnet" ? "ethereum" : "ethereum";
    const url = `https://coins.llama.fi/prices/current/${chain}:${tokenAddress}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.coins?.[`${chain}:${tokenAddress}`]?.price || 0;
  } catch (error) {
    console.warn("⚠ Error fetching price:", error);
    return 0;
  }
}

/* ==========================================
   FORMAT TRANSACTION HISTORY
========================================== */
function formatTransactionHistory(transactions, tokenDecimals) {
  if (transactions.length === 0) {
    return "<tr><td colspan='5'>No transactions</td></tr>";
  }

  let html = "";
  transactions.forEach((tx, index) => {
    const date = new Date(tx.block_timestamp).toLocaleDateString();
    const amount = (parseFloat(tx.value) / Math.pow(10, tokenDecimals || 18)).toFixed(4);
    const txHash = tx.transaction_hash?.slice(0, 10) + "..." || "N/A";
    
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 8px;">${index + 1}</td>
        <td style="padding: 8px;">${date}</td>
        <td style="padding: 8px;">${amount}</td>
        <td style="padding: 8px;">$${(parseFloat(tx.value) || 0).toFixed(2)}</td>
        <td style="padding: 8px;"><a href="https://etherscan.io/tx/${tx.transaction_hash}" target="_blank" style="color: #4dd2ff; text-decoration: none;">${txHash}</a></td>
      </tr>
    `;
  });
  return html;
}

/* ==========================================
   SHOW TRANSACTION HISTORY MODAL
========================================== */
async function showTransactionHistory(symbol, tokenAddr, decimals) {
  const wallet = localStorage.getItem("wallet");
  if (!wallet) return;

  const chainConfig = currentNetwork === "mainnet" ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet.sepolia;
  const transactions = await fetchTransactionsFromMoralis(wallet, chainConfig.chainId);
  
  const tokenTransactions = transactions.filter(
    tx => tx.address?.toLowerCase() === tokenAddr.toLowerCase()
  );

  const historyHTML = formatTransactionHistory(tokenTransactions, decimals);

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #0a0f24, #131b3a);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 15px;
      padding: 25px;
      max-width: 800px;
      max-height: 600px;
      overflow-y: auto;
      color: white;
    ">
      <h2 style="margin-top: 0; color: #4dd2ff;">${symbol} - Transaction History</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(255,255,255,0.3); background: rgba(77,210,255,0.1);">
            <th style="padding: 10px; text-align: left;">#</th>
            <th style="padding: 10px; text-align: left;">Date</th>
            <th style="padding: 10px; text-align: left;">Amount</th>
            <th style="padding: 10px; text-align: left;">Value</th>
            <th style="padding: 10px; text-align: left;">TX Hash</th>
          </tr>
        </thead>
        <tbody>
          ${historyHTML}
        </tbody>
      </table>
      <button onclick="this.parentElement.parentElement.remove()" style="
        margin-top: 15px;
        padding: 10px 20px;
        background: #4dd2ff;
        color: black;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
      ">Close</button>
    </div>
  `;

  document.body.appendChild(modal);
}

/* ==========================================
   AUTO DETECT TOKENS WITH MORALIS
========================================== */
async function autoDetectTokens(wallet) {
  const tbody = document.getElementById("tokens");
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan='7'><strong>⏳ Fetching token data with Moralis...</strong></td></tr>`;

  const chainConfig = currentNetwork === "mainnet" ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet.sepolia;

  let rows = "";
  let found = false;
  window.tokenValues = [];

  for (const tokenAddr of chainConfig.tokens) {
    try {
      let currentPrice = 0;
      if (currentNetwork === "mainnet") {
        currentPrice = await getTokenPrice(tokenAddr, "mainnet");
      }

      const transactions = await fetchTransactionsFromMoralis(wallet, chainConfig.chainId);
      
      const tokenTransactions = transactions.filter(
        tx => tx.address?.toLowerCase() === tokenAddr.toLowerCase()
      );

      if (tokenTransactions.length === 0) continue;

      found = true;

      const symbol = tokenTransactions[0].token_symbol || "UNKNOWN";
      const decimals = tokenTransactions[0].token_decimals || 18;

      const avgData = calculateWeightedAverage(tokenTransactions);
      const currentValue = avgData.totalAmount * currentPrice;
      const profitLossUSD = currentValue - avgData.totalSpent;
      const profitLossPercent = avgData.totalSpent > 0 ? (profitLossUSD / avgData.totalSpent) * 100 : 0;

      const profitColor = parseFloat(profitLossUSD) >= 0 ? "#00FF00" : "#FF0000";

      rows += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
          <td style="padding: 10px;"><strong>${symbol}</strong></td>
          <td style="padding: 10px;">${avgData.totalAmount.toFixed(4)}</td>
          <td style="padding: 10px;">$${avgData.avgPrice.toFixed(2)}</td>
          <td style="padding: 10px;">$${currentPrice.toFixed(2)}</td>
          <td style="padding: 10px; color: ${profitColor}; font-weight: bold;">$${profitLossUSD.toFixed(2)} (${profitLossPercent.toFixed(2)}%)</td>
          <td style="padding: 10px;">$${currentValue.toFixed(2)}</td>
          <td style="padding: 10px;">
            <button onclick="showTransactionHistory('${symbol}', '${tokenAddr}', ${decimals})" style="padding: 5px 10px; cursor: pointer; background: #4dd2ff; color: black; border: none; border-radius: 5px; font-weight: bold;">
              View
            </button>
          </td>
        </tr>
      `;

      window.tokenValues.push(parseFloat(currentValue));

    } catch (e) {
      console.warn("❌ Token metrics error:", tokenAddr, e);
    }
  }

  tbody.innerHTML = found
    ? rows
    : `<tr><td colspan="7">📭 No token history found on ${chainConfig.name}.</td></tr>`;
}

/* ==========================================
        SWITCH NETWORK
========================================== */
async function switchNetwork(networkName) {
  try {
    currentNetwork = networkName;
    const networkNameEl = document.getElementById("networkName");
    if (networkNameEl) {
      const chainConfig = networkName === "mainnet" ? CHAIN_CONFIG.mainnet : CHAIN_CONFIG.testnet.sepolia;
      networkNameEl.innerText = chainConfig.name;
    }
    
    updateNetworkButtons();
    
    const wallet = localStorage.getItem("wallet");
    if (wallet) {
      await autoDetectTokens(wallet);
    }
    
  } catch (error) {
    console.error("❌ Network switch error:", error);
  }
}

/* ==========================================
        UPDATE NETWORK BUTTON STATES
========================================== */
function updateNetworkButtons() {
  document.querySelectorAll(".network-btn").forEach(btn => {
    if (btn.dataset.network === currentNetwork) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/* ==========================================
            LOAD DASHBOARD CONTENT
========================================== */
async function loadDashboard() {
  const wallet = localStorage.getItem("wallet");
  if (!wallet) {
    console.log("❌ No wallet found in loadDashboard");
    window.location.href = "index.html";
    return;
  }

  console.log("📊 Loading dashboard for:", wallet);
  
  const walletEl = document.getElementById("wallet");
  const networkNameEl = document.getElementById("networkName");
  
  if (walletEl) walletEl.innerText = wallet;
  if (networkNameEl) {
    const chainConfig = CHAIN_CONFIG.mainnet;
    networkNameEl.innerText = chainConfig.name;
  }

  updateNetworkButtons();

  await Promise.all([
    loadBalance(wallet),
    autoDetectTokens(wallet)
  ]);

  calculatePortfolioValue();
}

/* ==========================================
          ETH BALANCE + PRICE
========================================== */
async function loadBalance(wallet) {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    const balance = await provider.getBalance(wallet);
    const eth = ethers.utils.formatEther(balance);

    const ethBalanceEl = document.getElementById("ethBalance");
    if (ethBalanceEl) ethBalanceEl.innerText = eth + " ETH";

    let price = 0;
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const j = await r.json();
    price = j?.ethereum?.usd || 0;

    const ethPriceEl = document.getElementById("ethPrice");
    if (ethPriceEl) {
      ethPriceEl.innerText = price ? "$" + price.toLocaleString() : "—";
    }

    window.dashboardEthValue = { balance: parseFloat(eth), price };

  } catch (e) {
    console.error("❌ Balance error:", e);
    const ethPriceEl = document.getElementById("ethPrice");
    if (ethPriceEl) ethPriceEl.innerText = 'ERROR';
  }
}

/* ==========================================
         PORTFOLIO CALCULATION
========================================== */
function calculatePortfolioValue() {
  const eth = window.dashboardEthValue?.balance || 0;
  const price = window.dashboardEthValue?.price || 0;

  const ethValue = eth * price;
  const tokenValue = window.tokenValues?.reduce((a, b) => a + b, 0) || 0;

  const portfolioEl = document.getElementById("portfolioValue");
  if (portfolioEl) {
    portfolioEl.innerText =
      "$" + (ethValue + tokenValue).toLocaleString(undefined, {
        maximumFractionDigits: 2
      });
  }
}

/* ==========================================
           LOGOUT
========================================== */
async function logoutWallet() {
  console.log("🔓 Starting logout process...");
  
  try {
    if (window.ethereum) {
      console.log("🔌 Disconnecting from MetaMask...");
      
      try {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
        console.log("✓ MetaMask connection revoked");
      } catch (revokeError) {
        console.log("⚠ Could not revoke MetaMask permissions:", revokeError.message);
      }
    }
  } catch (error) {
    console.log("⚠ Error during disconnect:", error);
  }
  
  console.log("🗑 Clearing app data...");
  localStorage.removeItem("wallet");
  sessionStorage.clear();
  
  window.dashboardEthValue = null;
  window.tokenValues = null;
  currentNetwork = "mainnet";
  
  console.log("✓ All data cleared");
  console.log("→ Redirecting to index.html");
  window.location.replace("index.html");
}
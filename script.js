console.log("script.js loaded");

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
const NETWORKS = {
  mainnet: {
    name: "Mainnet",
    chainIds: ["0x1"],
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
    name: "Testnet",
    chainIds: ["0xaa36a7", "0x13881"],
    tokens: [
      "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "0x6f14C02576fCb6c51f3a200F4c7367fEe1e2fEfD",
      "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
      "0xe6b8a5CF3BF352Ca4C69273F805C5CDA601D746b",
      "0x2c89bae432a5ba5cb79e10df3d4f0b4603718562"
    ]
  }
};

let currentNetwork = "mainnet";

/* ==========================================
        SWITCH NETWORK
========================================== */
async function switchNetwork(networkName) {
  try {
    currentNetwork = networkName;
    const networkNameEl = document.getElementById("networkName");
    if (networkNameEl) {
      networkNameEl.innerText = NETWORKS[currentNetwork].name;
    }
    
    updateNetworkButtons();
    
    const wallet = localStorage.getItem("wallet");
    if (wallet) {
      await autoDetectTokens(wallet);
    }
    
  } catch (error) {
    console.error("Network switch error:", error);
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
  if (networkNameEl) networkNameEl.innerText = NETWORKS[currentNetwork].name;

  updateNetworkButtons();

  await Promise.all([
    loadBalance(wallet),
    autoDetectTokens(wallet),
    displayTokenTracking(wallet)
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
          TOKEN AUTO DETECTION
========================================== */
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function autoDetectTokens(wallet) {
  const tbody = document.getElementById("tokens");
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="7">Detecting tokens...</td></tr>`;

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const tokenList = NETWORKS[currentNetwork].tokens;

  let rows = "";
  let found = false;
  window.tokenValues = [];

  for (const tokenAddr of tokenList) {
    try {
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
      const raw = await contract.balanceOf(wallet);

      if (raw.isZero()) continue;

      found = true;

      const decimals = await contract.decimals();
      const symbol = await contract.symbol();
      const bal = Number(ethers.utils.formatUnits(raw, decimals));

      let price = 0;
      if (currentNetwork === "mainnet") {
        const r = await fetch(`https://coins.llama.fi/prices/current/ethereum:${tokenAddr}`);
        const j = await r.json();
        price = j?.coins?.[`ethereum:${tokenAddr}`]?.price || 0;
      }

      const usd = bal * price;
      window.tokenValues.push(usd);

      rows += `
        <tr>
          <td>${symbol}</td>
          <td>${bal.toLocaleString()}</td>
          <td>—</td>
          <td>${price ? "$" + price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</td>
          <td>—</td>
          <td>${price ? "$" + usd.toFixed(2) : "—"}</td>
          <td><button class="action-btn" onclick="alert('More details coming soon')">View</button></td>
        </tr>
      `;

    } catch (e) {
      console.warn("Token scan error:", tokenAddr, e);
    }
  }

  tbody.innerHTML = found
    ? rows
    : `<tr><td colspan="7">No tokens found on ${NETWORKS[currentNetwork].name}.</td></tr>`;
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
     FETCH TOKEN TRANSACTIONS FROM MORALIS
========================================== */
async function fetchTokenTransactions(wallet) {
  try {
    console.log("📊 Fetching token transactions from Moralis...");
    
    // For now, use a simple approach - you'll add API key via a config
    // First, check if API key is stored anywhere
    let MORALIS_API_KEY = null;
    
    // Try multiple sources
    if (window.__MORALIS_API_KEY__) {
      MORALIS_API_KEY = window.__MORALIS_API_KEY__;
    } else if (typeof MORALIS_API_KEY_CONFIG !== 'undefined') {
      MORALIS_API_KEY = MORALIS_API_KEY_CONFIG;
    }
    
    if (!MORALIS_API_KEY) {
      console.error("❌ Moralis API key not configured");
      console.log("⚠️ IMPORTANT: You need to add your Moralis API key");
      console.log("Add this line to the TOP of your dashboard.html before other scripts:");
      console.log("<script>window.__MORALIS_API_KEY__ = 'your_moralis_api_key_here';</script>");
      return null;
    }

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2/${wallet}/erc20?chain=eth`,
      {
        method: "GET",
        headers: {
          "X-API-Key": MORALIS_API_KEY,
          "accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✓ Transactions fetched:", data);
    
    return data;
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    return null;
  }
}

/* ==========================================
   FETCH TOKEN TRANSACTION HISTORY
========================================== */
async function fetchTokenTransactionHistory(wallet, tokenAddress) {
  try {
    // Get API key from window object
    let MORALIS_API_KEY = null;
    
    if (window.__MORALIS_API_KEY__) {
      MORALIS_API_KEY = window.__MORALIS_API_KEY__;
    } else if (typeof MORALIS_API_KEY_CONFIG !== 'undefined') {
      MORALIS_API_KEY = MORALIS_API_KEY_CONFIG;
    }
    
    if (!MORALIS_API_KEY) {
      console.error("❌ Moralis API key not configured in fetchTokenTransactionHistory");
      return [];
    }
    
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2/erc20/${tokenAddress}/transfers?address=${wallet}&chain=eth&limit=100`,
      {
        method: "GET",
        headers: {
          "X-API-Key": MORALIS_API_KEY,
          "accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Transfer API error: ${response.status}`);
    }

    const data = await response.json();
    
    const transactions = data.result.map(tx => ({
      amount: parseFloat(tx.value) / Math.pow(10, tx.decimals),
      direction: tx.from_address.toLowerCase() === wallet.toLowerCase() ? "out" : "in",
      type: tx.from_address.toLowerCase() === wallet.toLowerCase() ? "sell" : "buy",
      timestamp: new Date(tx.block_timestamp),
      hash: tx.transaction_hash,
      priceAtTime: parseFloat(tx.value_decimal) || 0
    }));

    return transactions;
  } catch (error) {
    console.error("❌ Error fetching transaction history:", error);
    return [];
  }
}

/* ==========================================
   CALCULATE AVERAGE BUYING PRICE & STATS
========================================== */
function calculateTokenStats(transactions, currentPrice) {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  let totalAmount = 0;
  let totalSpent = 0;
  let buyTransactions = [];

  transactions.forEach(tx => {
    if (tx.type === "buy" || tx.direction === "in") {
      const amount = parseFloat(tx.amount);
      const price = parseFloat(tx.priceAtTime);
      const spent = amount * price;

      totalAmount += amount;
      totalSpent += spent;

      buyTransactions.push({
        amount,
        price,
        spent,
        timestamp: tx.timestamp
      });
    }
  });

  if (totalAmount === 0) return null;

  const averageBuyingPrice = totalSpent / totalAmount;
  const currentValue = totalAmount * currentPrice;
  const profitLoss = currentValue - totalSpent;
  const profitLossPercentage = (profitLoss / totalSpent) * 100;

  return {
    totalAmount,
    totalSpent,
    averageBuyingPrice,
    currentPrice,
    currentValue,
    profitLoss,
    profitLossPercentage,
    buyTransactions
  };
}

/* ==========================================
   ANALYZE ALL TOKENS WITH TRANSACTIONS
========================================== */
async function analyzeAllTokens(wallet) {
  try {
    console.log("🔍 Analyzing all tokens with transaction history...");
    
    const tokenData = await fetchTokenTransactions(wallet);
    
    if (!tokenData || !tokenData.result) {
      console.log("No token data found");
      return [];
    }

    let tokenStats = [];

    for (const token of tokenData.result) {
      try {
        const tokenAddress = token.token_address;
        const symbol = token.symbol;
        const currentBalance = parseFloat(token.balance) / Math.pow(10, token.decimals);
        const currentPrice = parseFloat(token.usd_price) || 0;

        const txHistory = await fetchTokenTransactionHistory(wallet, tokenAddress);
        
        if (txHistory && txHistory.length > 0) {
          const stats = calculateTokenStats(txHistory, currentPrice);
          
          if (stats) {
            tokenStats.push({
              symbol,
              tokenAddress,
              currentBalance,
              currentPrice,
              ...stats
            });
          }
        }
      } catch (error) {
        console.warn(`Error processing token ${token.symbol}:`, error);
      }
    }

    console.log("✓ Token analysis complete:", tokenStats);
    return tokenStats;
  } catch (error) {
    console.error("❌ Error analyzing tokens:", error);
    return [];
  }
}

/* ==========================================
   DISPLAY TOKEN TRACKING TABLE
========================================== */
async function displayTokenTracking(wallet) {
  try {
    const tbody = document.getElementById("tokenTracking");
    if (!tbody) {
      console.log("⚠ tokenTracking element not found");
      return;
    }
    
    tbody.innerHTML = `<tr><td colspan="8">Analyzing tokens with transaction history...</td></tr>`;

    const tokenStats = await analyzeAllTokens(wallet);

    if (tokenStats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">No token transactions found. Moralis may not have data yet.</td></tr>`;
      return;
    }

    let rows = "";
    
    tokenStats.forEach(token => {
      const profitLossColor = token.profitLoss >= 0 ? "#4dd2ff" : "#ff4d6d";
      const profitLossIcon = token.profitLoss >= 0 ? "📈" : "📉";

      rows += `
        <tr>
          <td>${token.symbol}</td>
          <td>${token.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
          <td>$${token.averageBuyingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td>$${token.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td>$${token.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td>$${token.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
          <td style="color: ${profitLossColor}; font-weight: bold;">
            ${profitLossIcon} $${token.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </td>
          <td style="color: ${profitLossColor}; font-weight: bold;">
            ${profitLossIcon} ${token.profitLossPercentage.toFixed(2)}%
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rows;
    displayPortfolioSummary(tokenStats);

  } catch (error) {
    console.error("❌ Error displaying token tracking:", error);
  }
}

/* ==========================================
   DISPLAY PORTFOLIO SUMMARY
========================================== */
function displayPortfolioSummary(tokenStats) {
  const totalSpent = tokenStats.reduce((sum, t) => sum + t.totalSpent, 0);
  const totalCurrentValue = tokenStats.reduce((sum, t) => sum + t.currentValue, 0);
  const totalProfitLoss = totalCurrentValue - totalSpent;
  const totalProfitLossPercentage = (totalProfitLoss / totalSpent) * 100;

  console.log("📊 Portfolio Summary:");
  console.log(`Total Spent: $${totalSpent.toLocaleString()}`);
  console.log(`Current Value: $${totalCurrentValue.toLocaleString()}`);
  console.log(`Profit/Loss: $${totalProfitLoss.toLocaleString()} (${totalProfitLossPercentage.toFixed(2)}%)`);

  const summaryEl = document.getElementById("portfolioSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="color: #4dd2ff; font-size: 14px; line-height: 1.8;">
        <p><strong>📊 Portfolio Summary (From Transaction History)</strong></p>
        <p>Total Invested: $${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <p>Current Value: $${totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <p style="color: ${totalProfitLoss >= 0 ? '#4dd2ff' : '#ff4d6d'}; font-weight: bold;">
          P&L: $${totalProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })} 
          (${totalProfitLossPercentage.toFixed(2)}%)
        </p>
      </div>
    `;
  }
}

/* ==========================================
           LOGOUT - PROPERLY FIXED
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
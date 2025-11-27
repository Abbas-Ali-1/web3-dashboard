console.log("script.js loaded");

// Etherscan API Configuration
const ETHERSCAN_API_KEY = "29WB2GZD1G2MGRVZ54JB474DNR3SA9J7MY"; // Replace with your Etherscan API key

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

  // Search button listener
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", searchWalletTransactions);
  }

  // Enter key support for search
  const searchInput = document.getElementById("searchWalletInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        searchWalletTransactions();
      }
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
  
  tbody.innerHTML = `<tr><td colspan="4">Detecting tokens...</td></tr>`;

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
          <td>${price ? "$" + usd.toFixed(2) : "—"}</td>
          <td>${currentNetwork === "mainnet" ? "Ethereum" : "Testnet"}</td>
        </tr>
      `;

    } catch (e) {
      console.warn("Token scan error:", tokenAddr, e);
    }
  }

  tbody.innerHTML = found
    ? rows
    : `<tr><td colspan="4">No tokens found on ${NETWORKS[currentNetwork].name}.</td></tr>`;
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
      SEARCH WALLET TRANSACTIONS (ETHERSCAN)
========================================== */
async function searchWalletTransactions() {
  const searchInput = document.getElementById("searchAddress");
  const address = searchInput.value.trim();

  if (!address) {
    alert("Please enter a wallet address");
    return;
  }

  // Basic validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    alert("Invalid Ethereum address format");
    return;
  }

  console.log("Searching transactions for:", address);

  // Show loading state
  const resultsDiv = document.getElementById("transactionResults");
  resultsDiv.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <p>Loading transactions...</p>
    </div>
  `;
  resultsDiv.style.display = "block";

  try {
    // Etherscan API call - Normal transactions
    const CHAIN_MAP = {
      mainnet: { id: "1", url: "https://api.etherscan.io/v2/api" },
      sepolia: { id: "11155111", url: "https://api-sepolia.etherscan.io/v2/api" },
      holesky: { id: "17000", url: "https://api-holesky.etherscan.io/v2/api" }
    };

    const selected = currentNetwork === "testnet" ? CHAIN_MAP.sepolia : CHAIN_MAP.mainnet;

    const response = await fetch(
      `${selected.url}?chainid=${selected.id}&module=account&action=txlist&address=${address}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`
    );


    const data = await response.json();
    console.log("Transaction data:", data);

    if (data.status === "1" && data.result) {
      displayTransactions(data.result, address);
    } else if (data.status === "0" && data.message === "No transactions found") {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p>No transactions found for this address</p>
        </div>
      `;
    } else {
      throw new Error(data.message || "API Error");
    }

  } catch (error) {
    console.error("Transaction fetch error:", error);
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #ff4d6d;">
        <p><strong>Error loading transactions</strong></p>
        <p style="font-size: 14px; opacity: 0.8;">${error.message}</p>
        <p style="font-size: 13px; margin-top: 10px;">
          Get a free Etherscan API key at: 
          <a href="https://etherscan.io/myapikey" target="_blank" style="color: #4dd2ff;">https://etherscan.io/myapikey</a>
        </p>
      </div>
    `;
  }
}

/* ==========================================
      DISPLAY TRANSACTIONS (ETHERSCAN FORMAT)
========================================== */ 
function displayTransactions(transactions, address) {
  const resultsDiv = document.getElementById("transactionResults");

  if (!transactions || transactions.length === 0) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <p>No transactions found for this address</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0;">Transaction History (Last ${transactions.length})</h3>
      <button onclick="closeTransactionResults()" style="background: rgba(255,255,255,0.1); border: none; padding: 8px 15px; border-radius: 8px; color: white; cursor: pointer;">Close</button>
    </div>
    <p style="font-size: 13px; opacity: 0.7; margin-bottom: 20px;">Address: ${address}</p>
    <div style="max-height: 500px; overflow-y: auto;">
  `;

  transactions.forEach((tx) => {
    const date = new Date(parseInt(tx.timeStamp) * 1000).toLocaleString();
    const value = parseFloat(tx.value) / 1e18; // Convert Wei to ETH
    const isReceived = tx.to.toLowerCase() === address.toLowerCase();
    const direction = isReceived ? "Received" : "Sent";
    const directionColor = isReceived ? "#4dd2ff" : "#ff4d6d";
    const isSuccess = tx.txreceipt_status === "1" || tx.isError === "0";

    html += `
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px; border-left: 3px solid ${directionColor};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center;">
          <div>
            <span style="color: ${directionColor}; font-weight: 600;">${direction}</span>
            ${!isSuccess ? '<span style="color: #ff4d6d; font-size: 12px; margin-left: 10px;">❌ Failed</span>' : ''}
          </div>
          <span style="font-weight: 600;">${value.toFixed(6)} ETH</span>
        </div>
        <div style="font-size: 13px; opacity: 0.7;">
          <p style="margin: 5px 0;">From: ${tx.from.slice(0, 10)}...${tx.from.slice(-8)}</p>
          <p style="margin: 5px 0;">To: ${tx.to.slice(0, 10)}...${tx.to.slice(-8)}</p>
          <p style="margin: 5px 0;">Date: ${date}</p>
          <p style="margin: 5px 0;">Gas: ${(parseInt(tx.gasUsed) * parseInt(tx.gasPrice) / 1e18).toFixed(6)} ETH</p>
          <p style="margin: 5px 0;">
            <a href="https://etherscan.io/tx/${tx.hash}" target="_blank" style="color: #4dd2ff; text-decoration: none;">
              View on Etherscan ↗
            </a>
          </p>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  resultsDiv.innerHTML = html;
}

function closeTransactionResults() {
  const resultsDiv = document.getElementById("transactionResults");
  resultsDiv.style.display = "none";
  document.getElementById("searchAddress").value = "";
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
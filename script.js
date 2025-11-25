console.log("script.js loaded");

// Moralis API Configuration
const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImUwZDAzNGI1LWQxZjktNDkzZC1iMWVjLTgyZmNkMTY1NmE5NiIsIm9yZ0lkIjoiNDgxODI2IiwidXNlcklkIjoiNDk1Njk4IiwidHlwZSI6IlBST0pFQ1QiLCJ0eXBlSWQiOiIyNjJkNTUxZS1iNDA4LTQ0ZmEtYTU1MS1mYTNiY2U0ZDk3NWEiLCJpYXQiOjE3NjM3Mjc2MTQsImV4cCI6NDkxOTQ4NzYxNH0.mgx_N-9l4QvIYztaOxT-HGTQfAkMwUhk1n-lTRsaTOY"; // Replace with your key from https://admin.moralis.io/

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("myButton");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    console.log("Logout button found, attaching listener");
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent any default behavior
      e.stopPropagation(); // Stop event bubbling
      console.log("Logout button clicked!");
      logoutWallet();
      return false; // Extra safety
    });
  } else {
    console.log("Logout button NOT found");
  }

  // Search button listener
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", searchWalletTransactions);
  }

  // Enter key support for search
  const searchInput = document.getElementById("searchAddress");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        searchWalletTransactions();
      }
    });
  }

  // Check if on dashboard page
  if (window.location.pathname.includes("dashboard.html")) {
    checkAuth();
  }
  
  // Check if on index page and user was logged in
  if (window.location.pathname.includes("index.html") || window.location.pathname === "/") {
    // Clear any stale session
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      console.log("User logged out - starting fresh");
    }
  }
});

/* ==========================================
      CHECK AUTHENTICATION
========================================== */
function checkAuth() {
  const wallet = localStorage.getItem("wallet");
  const justLoggedOut = sessionStorage.getItem("justLoggedOut");
  
  console.log("Checking auth - wallet:", wallet, "loggedOut:", justLoggedOut);
  
  // If logged out or no wallet, redirect
  if (justLoggedOut === "true" || !wallet) {
    console.log("Not authenticated - redirecting to index");
    localStorage.removeItem("wallet");
    sessionStorage.removeItem("justLoggedOut");
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
    alert("MetaMask not found!");
    return;
  }

  try {
    console.log("Connecting wallet...");
    
    // Clear logout flag
    sessionStorage.removeItem("justLoggedOut");
    
    // Request account access
    await ethereum.request({ method: "eth_requestAccounts" });
    const accounts = await ethereum.request({ method: "eth_accounts" });
    const wallet = accounts[0];

    console.log("Wallet connected:", wallet);
    localStorage.setItem("wallet", wallet);
    
    // Use href instead of replace for better compatibility
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("connectWallet error:", err);
    alert("Connection failed: " + err.message);
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
      "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2", // WETH
      "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"  // WBTC
    ]
  },
  testnet: {
    name: "Testnet",
    chainIds: ["0xaa36a7", "0x13881"],
    tokens: [
      "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH (Sepolia)
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI (Sepolia)
      "0x6f14C02576fCb6c51f3a200F4c7367fEe1e2fEfD", // USDC (Sepolia)
      "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889", // WMATIC (Mumbai)
      "0xe6b8a5CF3BF352Ca4C69273F805C5CDA601D746b", // DAI (Mumbai)
      "0x2c89bae432a5ba5cb79e10df3d4f0b4603718562"  // USDC (Mumbai)
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
    console.log("No wallet found in loadDashboard");
    window.location.href = "index.html";
    return;
  }

  console.log("Loading dashboard for:", wallet);
  
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

    // ETH PRICE
    let price = 0;
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const j = await r.json();
    price = j?.ethereum?.usd || 0;

    const ethPriceEl = document.getElementById("ethPrice");
    if (ethPriceEl) {
      ethPriceEl.innerText = price ? "$" + price.toLocaleString() : "—";
    }

    // Store for portfolio
    window.dashboardEthValue = { balance: parseFloat(eth), price };

  } catch (e) {
    console.error("Balance error:", e);
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
  
  tbody.innerHTML = `<tr><td colspan='4'>Detecting tokens...</td></tr>`;

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

      // Get price (only for mainnet)
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
                LOGOUT - IMPROVED
========================================== */
function logoutWallet() {
  console.log("Logging out...");
  
  // Set logout flag FIRST
  sessionStorage.setItem("justLoggedOut", "true");
  
  // Clear wallet data
  localStorage.removeItem("wallet");
  
  // Clear all cached data
  window.dashboardEthValue = null;
  window.tokenValues = null;
  
  console.log("Redirecting to index.html");
  
  // Force redirect
  window.location.href = "index.html";
}
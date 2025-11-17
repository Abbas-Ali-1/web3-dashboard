/*******************************
 * script.js
 * - Connect (index.html)
 * - Dashboard (dashboard.html)
 * - Automatic ERC-20 detection across multiple EVM chains via Moralis
 * - Token logos via Moralis metadata / CoinGecko fallback
 *******************************/

/* ===========================
   CONFIG - put your Moralis key here
   (You provided this key; leaving it in code is okay for testing,
    but NOT recommended for production.)
   =========================== */
const MORALIS_API = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImQ3OTIwOWZjLTUwZjgtNDdkNy04ZjM2LTI5MzllY2Q4Nzc3OSIsIm9yZ0lkIjoiNDgxODI2IiwidXNlcklkIjoiNDk1Njk4IiwidHlwZUlkIjoiMjYyZDU1MWUtYjQwOC00NGZhLWE1NTEtZmEzYmNlNGQ5NzVhIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjMzODQ4NTUsImV4cCI6NDkxOTE0NDg1NX0.ZkRPX9eYSg1-KN3gZ9CNvhA8c-kKTnFiXafYMCeyk2Q";

/* ===========================
   Chains to scan with Moralis (EVM chains)
   - feel free to add/remove identifiers Moralis supports
   =========================== */
const CHAINS = ["eth", "polygon", "bsc", "avalanche", "optimism", "arbitrum", "base"];

const isIndex = !!document.getElementById("myButton");
const isDashboard = window.location.pathname.includes("dashboard.html");

/* -------------------------
   CONNECT BUTTON (index.html)
   ------------------------- */
if (isIndex) {
  const connectBtn = document.getElementById("myButton");
  connectBtn.onclick = async () => {
    if (!window.ethereum) {
      alert("MetaMask not found. Install MetaMask and try again.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const wallet = accounts[0];
      localStorage.setItem("walletAddress", wallet);
      // go to dashboard
      window.location.href = "dashboard.html";
    } catch (e) {
      console.error("User rejected", e);
      alert("Connection rejected.");
    }
  };
}

/* -------------------------
   DASHBOARD (dashboard.html)
   ------------------------- */
if (isDashboard) {

  const wallet = localStorage.getItem("walletAddress");
  if (!wallet) {
    alert("No connected wallet found. Returning to connect page.");
    window.location.href = "index.html";
  }

  // UI elements
  const walletEl = document.getElementById("wallet");
  const ethBalEl = document.getElementById("ethBalance");
  const ethPriceEl = document.getElementById("tokenPrice");
  const portfolioEl = document.getElementById("portfolioValue");
  const tokensEl = document.getElementById("tokens");
  const backBtn = document.getElementById("backBtn");

  walletEl.innerText = "Wallet Address: " + wallet;

  backBtn?.addEventListener("click", () => {
    // quick way to "disconnect" in client: clear storage and go back
    localStorage.removeItem("walletAddress");
    window.location.href = "index.html";
  });

  // load everything
  (async function init() {
    try {
      const eth = await loadNativeBalance(wallet);
      const ethPrice = await loadEthPrice();
      ethBalEl.innerText = `ETH Balance: ${eth.toFixed(6)}`;
      ethPriceEl.innerText = `ETH Price (USD): $${Number(ethPrice).toLocaleString()}`;
      // Load tokens from Moralis across chains and show
      const tokenItems = await loadAllTokensAcrossChains(wallet);
      // compute token USD values if available and sum portfolio
      let totalUsd = eth * Number(ethPrice);
      renderTokenTable(tokenItems);
      // sum token USD if available
      tokenItems.forEach(t => {
        if (t.usd && !isNaN(t.usd)) totalUsd += Number(t.usd);
      });
      portfolioEl.innerText = `Total Portfolio Value (approx): $${totalUsd.toFixed(2)}`;
    } catch (e) {
      console.error(e);
      tokensEl.innerText = "Failed to load tokens. Check console for details.";
    }
  })();

  /* ---------- helper: fetch native balance (wei->ETH) ---------- */
  async function loadNativeBalance(addr) {
    // use MetaMask provider
    try {
      const balanceWeiHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [addr, "latest"]
      });
      // hex to decimal
      const bal = parseInt(balanceWeiHex, 16) / 1e18;
      return bal;
    } catch (e) {
      console.warn("eth_getBalance failed", e);
      return 0;
    }
  }

  /* ---------- helper: fetch ETH price from CoinGecko ---------- */
  async function loadEthPrice() {
    try {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const jd = await r.json();
      return jd.ethereum.usd;
    } catch (e) {
      console.warn("CoinGecko ETH price failed", e);
      return 0;
    }
  }

  /* ---------- load tokens across multiple chains via Moralis ---------- */
  async function loadAllTokensAcrossChains(addr) {
    // will collect { chain, token_address, name, symbol, balance, decimals, logo, usd }
    const aggregated = [];
    for (let chain of CHAINS) {
      try {
        const url = `https://deep-index.moralis.io/api/v2/${addr}/erc20?chain=${chain}&format=decimal`;
        const resp = await fetch(url, {
          headers: { "X-API-Key": MORALIS_API }
        });
        if (!resp.ok) {
          console.warn("Moralis chain fetch failed:", chain, resp.status);
          continue;
        }
        const items = await resp.json(); // array of tokens for this chain
        // Each item typically has: token_address, name, symbol, balance (string), decimals, logo, usdPrice (maybe)
        for (let it of items) {
          // normalize fields; Moralis responses vary a bit
          const token = {
            chain,
            token_address: it.token_address || it.contract_address || it.tokenAddress,
            name: it.name || it.contract_name || it.symbol || "Unknown",
            symbol: it.symbol || it.contract_ticker_symbol || "TKN",
            balance: Number(it.balance ?? it.balance_decimal ?? 0),
            // if format=decimal not supported, try fallback: parse raw balance with decimals
            decimals: Number(it.decimals ?? it.contract_decimals ?? (it.decimals ? it.decimals : 18)),
            logo: it.logo || it.logo_url || it.thumbnail || "",
            usd: (it.usdPrice ?? it.quote ?? it.quote_rate ?? it.usd_value ?? null)
          };

          // if balance is raw (not decimal) and decimals present, try convert:
          if (token.balance && token.balance > Math.pow(10, 36)) {
            // likely raw integer; convert
            token.balance = token.balance / Math.pow(10, token.decimals);
          }

          // skip zero balances
          if (!token.balance || Number(token.balance) === 0) continue;

          // Try to fill logo if missing (only for ethereum tokens we attempt CoinGecko)
          if (!token.logo && chain === "eth") {
            try {
              const cg = await fetch(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${token.token_address}`);
              if (cg.ok) {
                const j = await cg.json();
                token.logo = j.image?.small || j.image?.thumb || "";
              }
            } catch (e) {
              // ignore
            }
          }

          // Try to get USD price if not present (CoinGecko fallback for Ethereum)
          if ((!token.usd || token.usd === null) && chain === "eth") {
            try {
              const cgPrice = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${token.token_address}&vs_currencies=usd`);
              const pjson = await cgPrice.json();
              const pkey = Object.keys(pjson)[0];
              if (pkey && pjson[pkey] && pjson[pkey].usd) {
                token.usd = Number(pjson[pkey].usd) * Number(token.balance);
              }
            } catch (e) {
              // ignore
            }
          } else if (token.usd) {
            // if usd is per token or total? sometimes API gives per-token price, sometimes total.
            // Heuristic: if usd > balance*1e6 assume it's total; else assume per-token price and convert
            if (Number(token.usd) > 0 && Number(token.usd) < 1e6 && Number(token.usd) < Number(token.balance)) {
              // treat as price-per-token -> convert
              token.usd = Number(token.usd) * Number(token.balance);
            } else {
              // assume given usd is total already - keep as is
              token.usd = Number(token.usd);
            }
          }

          // push
          aggregated.push(token);
        }
      } catch (e) {
        console.warn("Error fetching tokens for chain", chain, e);
        continue;
      }
    }

    // optional: sort tokens by USD desc (if available), else by balance
    aggregated.sort((a,b) => (b.usd || 0) - (a.usd || 0));
    return aggregated;
  }

  /* ---------- Render token table ---------- */
  function renderTokenTable(items) {
    if (!items || items.length === 0) {
      tokensEl.innerHTML = "<div class='muted'>No tokens found on the selected chains.</div>";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Logo</th>
            <th>Name</th>
            <th>Symbol</th>
            <th>Chain</th>
            <th style="text-align:right">Balance</th>
            <th style="text-align:right">Value (USD)</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach(t => {
      const logo = t.logo && t.logo.length ? t.logo : "https://via.placeholder.com/34?text=•";
      const balanceStr = Number(t.balance).toLocaleString(undefined, { maximumFractionDigits: 6 });
      const usdStr = t.usd ? `$${Number(t.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—";

      html += `
        <tr>
          <td><img class="token-logo" src="${logo}" alt="${t.symbol}" onerror="this.src='https://via.placeholder.com/34?text=•'"></td>
          <td>${escapeHtml(t.name)}</td>
          <td>${escapeHtml(t.symbol)}</td>
          <td>${escapeHtml(t.chain)}</td>
          <td style="text-align:right">${balanceStr}</td>
          <td style="text-align:right">${usdStr}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    tokensEl.innerHTML = html;
  }

  /* safe simple HTML escape */
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }
}

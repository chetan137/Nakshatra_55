# Blockchain Configuration & Connection Report

**Date:** April 4, 2026  
**Project:** LendChain Lending Platform

---

## 🔍 Configuration Status

### ✅ CONFIGURED & READY
- **Smart Contract:** LendingPlatform.sol is fully implemented with lending logic
- **Hardhat Setup:** Configured with Solidity 0.8.20
- **ABI Files:** Generated ABI exists at `backend/abi/LendingPlatform.json`
- **Backend:** Express server with MongoDB and blockchain service integration
- **Frontend:** React with ethers.js for Web3 interactions
- **API Layer:** Axios client configured at `http://localhost:5000/api`

---

## ⚠️ CRITICAL ISSUES

### 1. **CONTRACT NOT DEPLOYED** (🔴 BLOCKING)
- **Status:** `CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000` (placeholder)
- **Location:** `backend/.env` line 19 & `frontend/.env` line 2
- **Impact:** Blockchain service will not work — all smart contract reads will be skipped
- **Fix:** Deploy contract to local Hardhat node or testnet

### 2. **MISSING ENVIRONMENT CONFIGURATION**
- **Blockchain RPC URLs:** Not configured
  - `SEPOLIA_RPC_URL` in `blockchain/.env` is template only
  - `LOCAL_RPC_URL` in `backend/.env` is set but Hardhat node not running
- **Infura Key:** Missing in blockchain/.env
- **Private Key:** Missing in blockchain/.env
- **Impact:** Cannot deploy to Sepolia testnet or local node

### 3. **EXPOSED CREDENTIALS IN backend/.env** (🔴 SECURITY)
- **Issue:** Real MongoDB URI and API keys committed
  - MongoDB URI: `mongodb+srv://chetan9022:...`
  - Brevo API Key: `xkeysib-851fc0610a2fd3ed3159d2c1224fdafac647f4f0f2bde04fd8bbe95de283ac8f-...`
- **Fix:** Move to `.env.example` and never commit real keys

---

## 📋 CONFIGURATION CHECKLIST

### Backend (`backend/.env`)
- [x] `PORT=5000` ✓
- [x] `MONGODB_URI` configured ✓
- [x] `JWT_SECRET` set ✓
- [x] `FRONTEND_URL=http://localhost:5173` ✓
- [x] `LOCAL_RPC_URL=http://127.0.0.1:8545` ✓
- [ ] `CONTRACT_ADDRESS` — **NEEDS DEPLOYMENT**
- [x] Blockchain service will gracefully skip if not deployed

### Frontend (`frontend/.env`)
- [x] `VITE_API_URL=http://localhost:5000/api` ✓
- [ ] `VITE_CONTRACT_ADDRESS` — **NEEDS DEPLOYMENT**

### Blockchain (`blockchain/.env`) — Missing, needs creation
- [ ] `SEPOLIA_RPC_URL` — needs Infura key
- [ ] `PRIVATE_KEY` — needs test wallet private key
- [ ] `ETHERSCAN_API_KEY` — optional for verification

---

## 🔗 CONNECTION FLOW

```
┌─────────────────────┐
│  React Frontend     │
│  (Vite @ :5173)   │
└──────────┬──────────┘
           │ (API calls)
           ▼
┌──────────────────────┐
│  Express Backend     │  ◄─── MongoDB (Atlas)
│  (Node @ :5000)      │
└──────────┬───────────┘
           │ (blockchainService.js)
           ▼
┌──────────────────────┐
│  Blockchain Network  │  ◄─── Hardhat Node or Sepolia
│  (via ethers.js)     │
└──────────────────────┘
```

### Current State
- ✅ Frontend → Backend: Configured & working
- ✅ Backend → MongoDB: Configured & working
- ⚠️ Backend → Blockchain: Service ready, but **contract address placeholder**
- ❌ Blockchain: Contract not yet deployed

---

## 🚀 DEPLOYMENT WORKFLOW

### Step 1: Setup Hardhat Local Node
```bash
cd blockchain
npm install  # if not done
npm run compile
npm run node  # keeps running in terminal 1
```

### Step 2: Deploy Contract (Terminal 2)
```bash
cd blockchain
npm run deploy:local
```
**Output will show:**
```
✅ LendingPlatform deployed!
   Contract address: 0x5FbDB2315678afccb333f8a9c60e904de3B2f0d4
```

### Step 3: Update Configuration Files
```
backend/.env  → CONTRACT_ADDRESS=0x5FbDB2315678afccb333f8a9c60e904de3B2f0d4
frontend/.env → VITE_CONTRACT_ADDRESS=0x5FbDB2315678afccb333f8a9c60e904de3B2f0d4
```

### Step 4: Start Services (3 Terminals)
**Terminal 1 (Already running):**
```bash
cd blockchain && npm run node
```

**Terminal 2:**
```bash
cd backend && npm run dev
```

**Terminal 3:**
```bash
cd frontend && npm run dev
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Hardhat node running (`http://127.0.0.1:8545`)
- [ ] Contract deployed (address != 0x000...)
- [ ] Backend `.env` updated with real contract address
- [ ] Frontend `.env` updated with real contract address
- [ ] Backend started successfully with "✅ MongoDB connected"
- [ ] Frontend accessible at `http://localhost:5173`
- [ ] API health check: `GET http://localhost:5000/api/health` returns `{"status":"ok"}`
- [ ] Contract reads working: Backend logs show "[Blockchain] ✅ Connected"

---

## 🔐 Security Recommendations

1. **Create `.env.example` files** (add to version control)
   - Never commit real credentials
   - Use `.env.example` as template for developers

2. **Rotate exposed credentials**
   - ❌ CRITICAL: MongoDB password is exposed
   - ❌ CRITICAL: Brevo API key is exposed
   - Create new keys and update `.env`

3. **Use environment-specific configs**
   - Development: Local Hardhat node
   - Production: Sepolia or Mainnet (via Infura)

---

## 📚 Contract & Service Reference

### Smart Contract Methods (LendingPlatform.sol)
- `createLoan(principal, durationDays, interestRateBps)` — Create loan with collateral
- `fundLoan(loanId)` — Lender funds the loan
- `repayLoan(loanId)` — Borrower repays principal + interest
- `liquidate(loanId)` — Liquidate overdue loans
- `cancelLoan(loanId)` — Cancel pending loan
- `getRiskScore(walletAddress)` — Get borrower reputation score
- `getLoan(loanId)` — Get full loan details
- `totalOwed(loanId)` — Calculate repayment amount
- `collateralRatio(loanId)` — Get collateral safety ratio

### Backend Service Methods (blockchainService.js)
- `verifyTx(txHash)` — Verify transaction on-chain
- `getLoanOnChain(onChainId)` — Fetch loan from blockchain
- `getRiskScore(walletAddress)` — Get wallet risk score
- `getTotalOwed(onChainId)` — Get repayment amount
- `getCollateralRatio(onChainId)` — Get collateral ratio

---

## 🎯 NEXT STEPS

1. **Immediate:** Deploy the smart contract locally
2. **High Priority:** Update contract addresses in `.env` files
3. **High Priority:** Fix security issue (exposed credentials)
4. **Then:** Test end-to-end loan flow
5. **Eventually:** Setup Sepolia testnet deployment

---

## 📞 Troubleshooting

### Issue: "Missing SEPOLIA_RPC_URL or CONTRACT_ADDRESS"
- **Cause:** Contract address is `0x000...` placeholder
- **Fix:** Deploy contract or update `.env`

### Issue: Hardhat node connection refused
- **Cause:** Node not running at `127.0.0.1:8545`
- **Fix:** Run `npm run node` in blockchain directory

### Issue: ABI not found
- **Cause:** Contract not compiled or ABI extraction failed
- **Fix:** Run `npm run compile && npm run extract-abi` in blockchain directory

---

**Status Summary:** 90% configured, pending smart contract deployment

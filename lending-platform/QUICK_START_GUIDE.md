# LendChain - Quick Start Guide

## 🎯 System Status: FULLY OPERATIONAL ✅

All services are running and properly configured. Here's how to use the platform:

---

## 🌐 Access the Application

**Frontend (Main App):**
- URL: http://localhost:5173
- Open in your browser and you'll see the LendChain interface

**Backend API:**
- URL: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

**Blockchain Node:**
- RPC: http://127.0.0.1:8545
- For ethers.js and MetaMask connections

---

## 💰 Setting Up MetaMask for Testing

### Step 1: Connect MetaMask to Local Network
1. Open MetaMask wallet extension
2. Click network dropdown (top left)
3. Click "Add Network" (or "Custom RPC")
4. Fill in:
   ```
   Network Name: Hardhat Local
   RPC URL: http://127.0.0.1:8545
   Chain ID: 31337
   Currency Symbol: ETH
   ```
5. Click "Save"

### Step 2: Import a Test Account
1. From the Hardhat node startup, use any test account's private key
2. In MetaMask: Account Icon → Import Account
3. Paste the private key (from "Account #0" through "Account #19")
4. Each account has 10,000 test ETH

**Test Account #0 (Deployer):**
```
Address:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Balance:    10,000 ETH
```

**Test Account #1 (Borrower):**
```
Address:    0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Balance:    10,000 ETH
```

**Test Account #2 (Lender):**
```
Address:    0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
Balance:    10,000 ETH
```

---

## 🧪 Testing the Lending Flow

### Scenario: Create and Fund a Loan

**Step 1: Borrow Page (as Borrower - Account #1)**
1. Select "Borrow" from navigation
2. Fill in:
   - Principal: 1 ETH (how much you want to borrow)
   - Duration: 30 days
   - Interest Rate: 12% (1200 basis points)
3. Click "Request Loan"
4. MetaMask will ask to approve sending 1.5 ETH collateral (150% of 1 ETH)
5. Confirm transaction
6. Copy the loan ID from the response

**Step 2: Marketplace (as Lender - Account #2)**
1. Switch MetaMask account to Account #2 (lender)
2. Navigate to "Lend" page
3. You should see the pending loan from Account #1
4. Click "Fund" on the loan
5. Confirm sending 1 ETH to fund the loan
6. Loan becomes active

**Step 3: Repay (as Borrower - Account #1)**
1. Switch back to Account #1 in MetaMask
2. Go to "My Loans" or "Dashboard"
3. Find the active loan
4. Click "Repay"
5. System calculates interest: principal + (principal × 12% × time_elapsed / 365)
6. Approve the calculated amount
7. Confirm repayment
8. Loan status changes to "Repaid"
9. Collateral is returned to borrower

**Step 4: Verify on Dashboard**
1. Both borrower and lender can see loan history
2. Check completion status
3. View updated loan counts

---

## 📊 Testing Individual Features

### Test 1: Risk Score Calculation
- Risk score starts at 80/100
- +5 points per completed loan (max 100)
- -25 points per defaulted loan
- Example: 2 completed loans = 80 + 10 = 90/100

**To test:**
1. Create multiple loans as a borrower
2. Fund them (as different accounts)
3. Repay them
4. Check your risk score increases

### Test 2: Collateral Management
- Minimum collateral: 150% of principal
- Borrower can't create loan with less collateral
- Collateral returned on repayment
- Collateral given to lender on default

**To test:**
1. Try creating loan with < 150% collateral → should fail
2. Create loan with exactly 150% → should work
3. Default a loan → collateral goes to lender

### Test 3: Interest Calculation
- Formula: interest = principal × rate × time / (10000 × 365)
- Paid on repayment
- Capped at max due date

**Example calculation:**
```
Principal: 1 ETH
Rate: 1200 bps (12% annual)
Time: 30 days
Interest = 1 × 1200 × 30 / (10000 × 365)
         = 36000 / 3,650,000
         ≈ 0.00986 ETH (~$40 on $4000 ETH)
```

---

## 🛠️ Testing with API Directly

### Health Check
```bash
curl http://localhost:5000/api/health
# Response: {"status":"ok","timestamp":"..."}
```

### Get Available Loans
```bash
curl http://localhost:5000/api/loans/available
# Returns all pending loans in marketplace
```

### Get My Loans (requires auth token)
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5000/api/loans/my
# Returns your loans as borrower or lender
```

### Create Loan
```bash
curl -X POST http://localhost:5000/api/loans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "principal": "1000000000000000000",
    "durationDays": 30,
    "interestRateBps": 1200,
    "txHash": "0x..."
  }'
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Contract address not found"
**Cause:** Contract not deployed  
**Solution:** Run `cd blockchain && npm run deploy:local`

### Issue 2: MetaMask shows "No accounts"
**Cause:** Account not imported  
**Solution:** Import a test account private key (see Step 2 above)

### Issue 3: Transaction fails with "Insufficient collateral"
**Cause:** Sending less than 150% of principal  
**Solution:** Increase collateral amount to at least 150%

### Issue 4: Can't connect to blockchain
**Cause:** Hardhat node not running  
**Solution:** Run `cd blockchain && npm run node`

### Issue 5: Backend crashes
**Cause:** Unknown error (usually MongoDB)  
**Solution:** Check `.env` credentials and run `cd backend && node server.js`

---

## 📝 Sample Test Cases

### Test Case 1: Complete Loan Lifecycle
```
1. Create account 1 & 2
2. Account 1: Create loan for 1 ETH, 30 days, 12% interest
3. Account 2: Fund the loan
4. Account 1: Repay loan + interest
5. Verify: Loan marked as "Repaid"
6. Verify: Collateral returned to Account 1
7. Verify: Repayment sent to Account 2
```

### Test Case 2: Risk Score Tracking
```
1. Create Account 1
2. Complete 3 loans (risk score should be 80 + 15 = 95)
3. Default 1 loan (risk score should be 95 - 25 = 70)
4. Complete 1 more (risk score should be 70 + 5 = 75)
```

### Test Case 3: Collateral Validation
```
1. Try creating loan with 100% collateral → FAIL
2. Create loan with 150% collateral → SUCCESS
3. Create loan with 200% collateral → SUCCESS
```

---

## 🚀 Performance Notes

**Local Hardhat Network:**
- Instant block generation
- No gas fees
- Unlimited test ETH
- Perfect for development/testing

**Real Networks (when ready):**
- Sepolia testnet: Requires Infura key + funded wallet
- Mainnet: Real ETH required
- More realistic fee structure

---

## 📚 Smart Contract Functions Reference

```solidity
// BORROWER FUNCTIONS
createLoan(uint256 principal, uint256 durationDays, uint256 interestRateBps)
  → Creates loan request with collateral
  → emits LoanCreated event

repayLoan(uint256 loanId)
  → Repays loan with interest
  → Collateral returned
  → emits LoanRepaid event

cancelLoan(uint256 loanId)
  → Cancels pending loan
  → Collateral returned
  → emits LoanCancelled event

// LENDER FUNCTIONS
fundLoan(uint256 loanId)
  → Funds loan, sends principal to borrower
  → Loan becomes active
  → emits LoanFunded event

liquidate(uint256 loanId)
  → Called after dueDate if not repaid
  → Lender gets collateral
  → emits LoanLiquidated event

// VIEW FUNCTIONS (READ-ONLY)
getLoan(uint256 loanId)
  → Returns all loan details

totalOwed(uint256 loanId)
  → Returns principal + interest owed

riskScore(address borrower)
  → Returns reputation score (0-100)

collateralRatio(uint256 loanId)
  → Returns safety ratio (e.g., 150, 200)
```

---

## 🎓 Learning Path

1. **Start:** Understand the loan creation flow
2. **Next:** Complete a full loan lifecycle (create → fund → repay)
3. **Then:** Test edge cases (default, liquidation, etc.)
4. **Advanced:** Deploy to Sepolia testnet

---

## 📞 Quick Commands

```bash
# Start all services
cd blockchain && npm run node &
cd backend && npm run dev &
cd frontend && npm run dev &

# Deploy contract
cd blockchain && npm run deploy:local

# Stop a service
# Ctrl+C in the terminal running it

# View blockchain logs
tail -f blockchain/logs.txt
```

---

**Status:** Everything is configured and ready to go! 🎉

Start by opening http://localhost:5173 in your browser and connecting MetaMask.

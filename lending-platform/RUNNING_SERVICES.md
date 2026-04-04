# 🚀 Running Services - Keep This Open

## CRITICAL: These 3 Services Must Be Running Simultaneously

```
┌─────────────────────────────────────────────────────────────┐
│  Keep 3 Terminal Windows Open (or use tmux/screen)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Terminal 1: Blockchain Node ⛓️

**MUST run first - Other services depend on it**

```bash
cd blockchain
npm run node
```

**Expected Output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
... (20 accounts total)
```

**Status:** ✅ Running when you see RPC messages  
**Port:** http://127.0.0.1:8545  
**Keep this terminal open!** Do NOT close.

---

## Terminal 2: Backend API Server 🔗

**Run AFTER blockchain node is ready**

```bash
cd backend
npm run dev
```

**Expected Output:**
```
✅ MongoDB connected
🚀 Server running on port 5000
```

**Status:** ✅ Ready when you see both messages  
**Port:** http://localhost:5000  
**Test:** `curl http://localhost:5000/api/health`  
**Keep this terminal open!** Do NOT close.

---

## Terminal 3: Frontend Dev Server 🌐

**Run AFTER backend is ready**

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE v5.4.21  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Status:** ✅ Ready when you see the URL  
**Port:** http://localhost:5173  
**Open:** Click the URL or open browser to http://localhost:5173  
**Keep this terminal open!** Do NOT close.

---

## 🎯 Quick Launch Script

**For Linux/Mac users, create `start.sh`:**
```bash
#!/bin/bash
echo "Starting LendChain services..."
cd blockchain && npm run node &
sleep 5
cd ../backend && npm run dev &
cd ../frontend && npm run dev &
echo "All services started! Open http://localhost:5173"
```

**For Windows users, create `start.cmd`:**
```cmd
@echo off
echo Starting LendChain services...
start cmd /k "cd blockchain && npm run node"
timeout /t 5
start cmd /k "cd backend && npm run dev"
start cmd /k "cd frontend && npm run dev"
echo All services started! Open http://localhost:5173
```

---

## ✅ Verification Checklist

After starting all 3 services, verify:

- [ ] Terminal 1: Blockchain shows "HTTP and WebSocket JSON-RPC server"
- [ ] Terminal 2: Backend shows "✅ MongoDB connected" + "🚀 Server running"
- [ ] Terminal 3: Frontend shows "➜ Local: http://localhost:5173"
- [ ] Can access http://localhost:5173 in browser
- [ ] Browser loads LendChain interface
- [ ] No red errors in any terminal

---

## 🚨 If Something Goes Wrong

### Blockchain Node Won't Start
```bash
# Kill existing process
lsof -i :8545 | kill -9 $(awk 'NR!=1 {print $2}')

# Or restart manually
cd blockchain && npm run node
```

### Backend Won't Connect
```bash
# Check MongoDB connection
cd backend
node server.js

# If MongoDB error, verify .env has correct URI
cat .env | grep MONGODB
```

### Frontend Shows Blank Page
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Contract Address Mismatch
```bash
# Redeploy contract
cd blockchain
npm run deploy:local

# Update addresses in:
# backend/.env → CONTRACT_ADDRESS=0x...
# frontend/.env → VITE_CONTRACT_ADDRESS=0x...
```

---

## 📊 Service Status Dashboard

Check status anytime:

```bash
# Health check
curl http://localhost:5000/api/health

# Test frontend
curl http://localhost:5173 | head -20

# Test blockchain RPC
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 🛑 Stopping Services

**Do NOT just close terminals!** Use Ctrl+C in each terminal:

```bash
# In each terminal, press: Ctrl+C
# Wait for clean shutdown
# Then close the terminal
```

**Order to stop (bottom-up):**
1. Frontend (Terminal 3)
2. Backend (Terminal 2)
3. Blockchain (Terminal 1) ← Stop last

---

## 🔄 Restarting Everything

```bash
# Stop all services (Ctrl+C in each terminal)

# Then restart in order:
# Terminal 1: cd blockchain && npm run node
# Terminal 2: cd backend && npm run dev
# Terminal 3: cd frontend && npm run dev
```

---

## 📱 Access Points

Once all services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main app |
| Backend | http://localhost:5000/api | API |
| Health | http://localhost:5000/api/health | Status |
| Blockchain | http://127.0.0.1:8545 | RPC endpoint |

---

## 💡 Pro Tips

1. **Use tmux** for easier multi-terminal management:
   ```bash
   tmux new-session -d -s blockchain "cd blockchain && npm run node"
   tmux new-window -t blockchain "cd backend && npm run dev"
   tmux new-window -t blockchain "cd frontend && npm run dev"
   tmux attach -t blockchain
   ```

2. **Keep separate terminal tabs** so you can see all logs

3. **Monitor logs** to catch errors early

4. **Don't restart all at once** - start from bottom (blockchain first)

---

## 🎯 Remember

- **Blockchain MUST run first**
- **All 3 must run simultaneously**
- **Keep terminals open - don't minimize**
- **Stop gracefully with Ctrl+C**
- **Check for connection errors in logs**

---

**Status: Ready to develop! 🚀**

Open http://localhost:5173 in your browser and start testing.

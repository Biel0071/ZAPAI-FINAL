# ZapFlow Quick Reference Card

## 🚀 Start System (30 seconds)

```powershell
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
node localRuntimeAgent.js
```

**Expected Output:**
```
✅ Local Runtime Agent started on port 4000
✅ Ready to receive activation requests
✅ Log file: logs/runtime.log
```

---

## 📋 What Happens When User Clicks "Activate"

```
1️⃣  Frontend sends: POST /system/activate
                        ↓
2️⃣  PowerShell prompt appears on local computer
    "Do you want to start the system now? (Y/N)"
                        ↓
3️⃣  User types: Y (and presses Enter)
                        ↓
4️⃣  Agent spawns:
    - Node.js server (localhost:4000)
    - ngrok tunnel (https://xxxx.ngrok-free.dev)
                        ↓
5️⃣  Frontend receives: { status: "starting", ngrok: "https://..." }
                        ↓
6️⃣  Frontend polls: GET /system/runtime/status
    Until: ngrok = "connected"
                        ↓
7️⃣  System ready! ✅ Connected indicator shows in UI
```

---

## 🔗 All API Endpoints

### Activation
```
POST /system/activate
  Response: { status: "starting", ngrok: "https://..." }
```

### Status
```
GET /system/runtime/status
  Response: { runtime: "running", ngrok: "connected", ngrokURL: "..." }
```

### Logs
```
GET /system/runtime/logs?limit=50
  Response: { logs: [...] }
```

### Stop
```
POST /system/stop
  Response: { status: "stopped" }
```

### Health
```
GET /health
  Response: { status: "ok", timestamp: "..." }
```

---

## 🔍 Check Status

```powershell
# Is system running?
curl http://127.0.0.1:4000/system/runtime/status

# View logs
curl "http://127.0.0.1:4000/system/runtime/logs?limit=20"

# Health check
curl http://127.0.0.1:4000/health
```

---

## ❌ Troubleshooting

### Port 4000 in use?
```powershell
taskkill /IM node.exe /F
taskkill /IM ngrok.exe /F
```

### ngrok not installed?
```powershell
npm install -g ngrok
# or: winget install ngrok
```

### Can't see logs?
```powershell
Get-Content -Path "logs/runtime.log" -Tail 20
```

### Manual stop?
```powershell
curl -X POST http://127.0.0.1:4000/system/stop
```

---

## 📊 Files Created

| File | Purpose |
|------|---------|
| `localRuntimeAgent.js` | Main agent (400+ lines) |
| `docs/LOCAL_RUNTIME_AGENT.md` | Technical reference |
| `docs/STARTUP_GUIDE.md` | Getting started |
| `docs/POWERSHELL_ACTIVATION_FLOW.md` | Flow details |

---

## 🎯 Frontend Integration

```javascript
// 1. Call activation
const res = await fetch('/system/activate', { method: 'POST' });
const data = await res.json();

// 2. Poll status
const checkStatus = async () => {
  const res = await fetch('/system/runtime/status');
  const status = await res.json();
  
  if (status.ngrok === 'connected') {
    console.log('✅ Connected!');
    return true;
  }
  return false;
};

// 3. Retry until connected
while (!await checkStatus()) {
  await new Promise(r => setTimeout(r, 1000));
}
```

---

## ⏱️ Timing

| Step | Time |
|------|------|
| Agent startup | < 1s |
| User confirmation | 0-30s |
| Start Node + ngrok | 3-5s |
| ngrok connects | 2-3s |
| **Total** | **~5-10s** |

---

## 📋 Checklist

- [ ] Agent runs: `node localRuntimeAgent.js`
- [ ] No errors in logs/runtime.log
- [ ] Frontend opens Lovable dashboard
- [ ] Click "Activate System"
- [ ] PowerShell prompt appears
- [ ] Type Y and press Enter
- [ ] System starts (check logs)
- [ ] Status shows "connected"
- [ ] Test message flow works

---

## 🆘 Get Help

1. Check logs:
   ```powershell
   Get-Content "logs/runtime.log" -Tail 50
   ```

2. Test endpoint:
   ```powershell
   curl http://127.0.0.1:4000/health
   ```

3. See full documentation:
   - `docs/LOCAL_RUNTIME_AGENT.md` (technical)
   - `docs/STARTUP_GUIDE.md` (getting started)
   - `docs/POWERSHELL_ACTIVATION_FLOW.md` (activation flow)

---

**Version:** 1.0.0 | **Status:** ✅ Production Ready


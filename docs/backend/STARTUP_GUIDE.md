# ZapFlow System Startup Guide

## Overview

This guide explains how to start the ZapFlow system, including the local runtime agent and all supporting services.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Lovable Frontend                          │
│              (HTTPS - Cloud Hosted)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Supabase Edge Function (Proxy)                   │
│           Routes requests through ngrok                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ngrok Tunnel (Public HTTPS)                    │
│         https://xxxx.ngrok-free.dev                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (Local Network)
┌─────────────────────────────────────────────────────────────┐
│          Local Runtime Agent (127.0.0.1:4000)               │
│                  ├─ Node.js Server                          │
│                  ├─ Express Routes                          │
│                  ├─ Baileys Integration                     │
│                  └─ ngrok Management                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start (Simplest Method)

### Step 1: Open Terminal

```powershell
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
```

### Step 2: Run Local Runtime Agent

```powershell
node localRuntimeAgent.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║         ZapFlow Local Runtime Agent                       ║
║         Listening on http://127.0.0.1:4000                ║
╚════════════════════════════════════════════════════════════╝

Endpoints:
  POST /system/activate    - Start runtime and ngrok
  GET  /system/runtime/status - Check runtime status
  GET  /system/runtime/logs   - View recent logs
  POST /system/stop        - Stop runtime
  GET  /health            - Health check

Log file: logs/runtime.log
```

### Step 3: Activate from Frontend

1. Open Lovable dashboard
2. Click "Activate System" button
3. PowerShell prompt appears asking for confirmation
4. Type `Y` and press Enter
5. System starts automatically

## Alternative: Full Startup Script

If you want a more automated startup with ngrok and system validation, use the PowerShell startup script:

```powershell
# Full startup with ngrok tunnel and validation
.\START_ZAPAI.ps1 -Port 4000 -StartNgrok -ValidateRemote

# Or in shorter form:
.\START_ZAPAI.ps1 -StartNgrok -ValidateRemote
```

**Parameters:**
- `-Port 4000` - Port for Node.js server (default: 4000)
- `-SkipInstall` - Skip npm install (use cached dependencies)
- `-StartNgrok` - Start ngrok tunnel as separate process
- `-ActivateSystem` - Activate system after startup
- `-ValidateRemote` - Test external endpoints via ngrok

## Detailed Startup Sequence

### Option A: Local Runtime Agent (Recommended for Development)

```powershell
# Terminal 1: Run local runtime agent
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
node localRuntimeAgent.js

# Output:
# [INFO] Local Runtime Agent started on port 4000
# Ready to receive activation requests
```

**What Happens:**
1. Agent starts HTTP server on 127.0.0.1:4000
2. Listens for POST /system/activate
3. When activated, spawns Node.js server
4. After 3 seconds, spawns ngrok tunnel
5. Returns ngrok URL to frontend
6. Monitors ngrok health every 5 seconds
7. Auto-restarts ngrok if tunnel fails

**When to Use:**
- Development/testing
- Single activation per session
- Want agent to manage everything
- ngrok tunnel is separate (not started manually)

### Option B: PowerShell Startup Script (More Control)

```powershell
# Run startup script with all options
.\START_ZAPAI.ps1 -StartNgrok -ValidateRemote

# Or with custom port:
.\START_ZAPAI.ps1 -Port 3000 -StartNgrok -ValidateRemote -SkipInstall
```

**Process Started:**
1. PowerShell validates Node.js and npm
2. Installs/validates npm dependencies
3. Starts ngrok in separate PowerShell window
4. Waits for ngrok to connect and gets public URL
5. Starts main Node.js server
6. Validates all endpoints (local + remote)
7. Reports PIDs and log file locations

**When to Use:**
- Production deployment
- Want separate control of ngrok
- Need endpoint validation
- Testing remote connections

### Option C: Manual Multi-Terminal Setup

**Terminal 1: Node.js Server**
```powershell
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
npm install  # if needed
npm start    # or: node server.js
```

**Terminal 2: ngrok Tunnel**
```powershell
ngrok http 4000
# ngrok starts tunneling to http://localhost:4000
# Shows public URL like: https://xxxx.ngrok-free.dev
```

**Terminal 3: Local Runtime Agent (optional)**
```powershell
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
node localRuntimeAgent.js
```

**When to Use:**
- Maximum control over each component
- Debugging individual pieces
- Understanding the system
- Testing without full automation

## Frontend Integration

### Step 1: Update Frontend Configuration

In Lovable dashboard, set:
```javascript
const RUNTIME_API = 'http://127.0.0.1:4000'  // Local
// or
const RUNTIME_API = 'https://xxxx.ngrok-free.dev'  // Remote (ngrok)
```

### Step 2: Implement Activation Flow

```javascript
async function activateSystem() {
  try {
    // Step 1: Request activation
    const res = await fetch('/system/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (data.status === 'starting') {
      console.log('System activation confirmed. Starting runtime...');
      
      // Step 2: Poll until connected
      pollRuntimeStatus();
    } else if (data.status === 'already_running') {
      console.log('System already running');
      showConnected(data.ngrok);
    } else {
      console.error('Activation failed:', data.message);
    }
  } catch (error) {
    console.error('Activation error:', error);
  }
}

async function pollRuntimeStatus() {
  let attempts = 0;
  const maxAttempts = 60;

  const interval = setInterval(async () => {
    try {
      const res = await fetch('/system/runtime/status');
      const status = await res.json();

      if (status.ngrok === 'connected') {
        console.log('✅ System connected!');
        showConnected(status.ngrokURL);
        clearInterval(interval);
      }
    } catch (e) {
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.error('❌ Connection timeout');
      showError('System activation timeout');
      clearInterval(interval);
    }
  }, 1000); // Poll every 1 second
}

function showConnected(ngrokURL) {
  // Update UI to show system is ready
  console.log('Connected via:', ngrokURL);
  // Update TARGET_URL for API calls
  // Update UI status indicator
}
```

## Environment Variables

### Required (if using database features)

```bash
DATABASE_URL=your_supabase_connection_string
```

### Optional

```bash
# Port for Node.js server
PORT=4000

# Node.js environment
NODE_ENV=production

# ngrok region
NGROK_REGION=us
```

### How to Set (PowerShell)

```powershell
$env:PORT = "4000"
$env:NODE_ENV = "production"
$env:DATABASE_URL = "your_connection_string"
npm start
```

### How to Set (Windows batch)

```batch
set PORT=4000
set NODE_ENV=production
set DATABASE_URL=your_connection_string
npm start
```

## Log Monitoring

### Real-time Logs

```powershell
# Watch runtime logs
Get-Content -Path "logs/runtime.log" -Wait

# Filter by level
Select-String "error" logs/runtime.log | Get-Content -Wait

# Last 50 lines
Get-Content -Path "logs/runtime.log" -Tail 50
```

### Log Locations

```
logs/
├─ runtime.log              # Main event log (JSON lines)
├─ runtime_stdout.log       # Node.js stdout
├─ runtime_stderr.log       # Node.js stderr
├─ ngrok_stdout.log         # ngrok output
├─ ngrok_url.json          # Current tunnel URL
└─ runtime.lock            # Process lock file
```

### Log Entry Format

```json
{
  "timestamp": "2026-03-16T10:30:00.000Z",
  "level": "info",
  "message": "Node.js runtime started",
  "ip": "192.168.1.100",
  "action": "startup_sequence",
  "nodePID": 12345,
  "status": "success"
}
```

## Health Checks

### Check Agent Health

```powershell
# Simple health check
curl http://127.0.0.1:4000/health

# Check runtime status
curl http://127.0.0.1:4000/system/runtime/status

# Get recent logs (last 50)
curl "http://127.0.0.1:4000/system/runtime/logs?limit=50"
```

### Expected Responses

**HTTP 200 - Connected:**
```json
{
  "runtime": "running",
  "ngrok": "connected",
  "ngrokURL": "https://xxxx.ngrok-free.dev",
  "nodePID": 12345,
  "ngrokPID": 12346
}
```

**HTTP 200 - Connecting:**
```json
{
  "runtime": "running",
  "ngrok": "connecting",
  "ngrokURL": null
}
```

**HTTP 200 - Offline:**
```json
{
  "runtime": "stopped",
  "ngrok": "offline"
}
```

## Troubleshooting

### Problem: "Port 4000 already in use"

**Solution:**
```powershell
# Find process on port 4000
netstat -ano | findstr ":4000"

# Kill by PID
taskkill /PID <PID> /F

# Or kill all node processes
taskkill /IM node.exe /F
taskkill /IM ngrok.exe /F
```

### Problem: "ngrok executable not found"

**Solution:**
```powershell
# Install ngrok
npm install -g ngrok

# Or download from: https://ngrok.com/download

# Verify installation
ngrok --version
```

### Problem: Agent starts but ngrok doesn't connect

**Check logs:**
```powershell
cat logs/runtime.log | Select-String "ngrok_startup"
cat logs/runtime.log | Select-String "error"
```

**Manual test:**
```powershell
# Test ngrok manually
ngrok http 4000

# You should see: "Session started"
```

### Problem: PowerShell confirmation prompt doesn't appear

**Cause:** PowerShell might not be showing
**Solution:**
```powershell
# Make sure you're NOT running PowerShell ISE
# Use regular PowerShell or Windows Terminal

# Or use alternative activation:
curl -X POST http://127.0.0.1:4000/system/activate
```

### Problem: Frontend can't reach system after activation

**Check ngrok tunnel:**
```powershell
# Get current tunnel URL
cat logs/ngrok_url.json

# Or from agent logs
cat logs/runtime.log | Select-String "ngrok"
```

**Update frontend configuration:**
```javascript
// Use the URL from logs/ngrok_url.json
const RUNTIME_API = 'https://xxxx.ngrok-free.dev'
```

## Testing Endpoints

### Test Activation

```powershell
# PowerShell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:4000/system/activate" `
  -ContentType "application/json" `
  -Body (@{} | ConvertTo-Json)

# Expected: status = "starting"
```

### Test Status

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:4000/system/runtime/status"

# Expected: runtime = "running", ngrok = "connected"
```

### Test Stop

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:4000/system/stop"

# Expected: status = "stopped"
```

## Performance Expectations

| Task | Time |
|------|------|
| Agent startup | < 1 second |
| Show confirmation prompt | Immediate |
| Start Node.js server | 1-2 seconds |
| Start ngrok tunnel | 1-2 seconds |
| ngrok connects | 2-3 seconds |
| **Total to "connected"** | **~5-10 seconds** |
| Health check interval | 5 seconds |
| Auto-restart on failure | < 10 seconds |

## Common Workflows

### Workflow 1: Development Session

```powershell
# Terminal 1: Start agent
cd c:\projetos\ai-whatsapp-saas\backend\baileys-server
node localRuntimeAgent.js

# Wait for output:
# [INFO] Local Runtime Agent started on port 4000

# Terminal 2: Open Lovable dashboard
# Click "Activate System"

# Terminal 1: You'll see:
# [INFO] Activation request received
# [INFO] Node.js runtime started
# [INFO] ngrok tunnel started
# [INFO] ngrok tunnel connected
```

### Workflow 2: Testing Remote Connection

```powershell
# Terminal 1: Startup with ngrok
.\START_ZAPAI.ps1 -StartNgrok -ValidateRemote

# Output will show:
# "Atualize TARGET_API_URL com: https://xxxx.ngrok-free.dev"

# Terminal 2: Update Lovable frontend with that URL

# Terminal 1: See validation results
# "remote system/status: {success}"
```

### Workflow 3: Production Deployment

```powershell
# Install as Windows Service
npm install -g nssm
nssm install ZapFlowAgent node C:\path\to\localRuntimeAgent.js
nssm start ZapFlowAgent

# Check status
Get-Service ZapFlowAgent

# View logs
Get-Content -Path "logs/runtime.log" -Wait

# Stop service
nssm stop ZapFlowAgent
```

## Files Reference

| File | Purpose | When Used |
|------|---------|-----------|
| `localRuntimeAgent.js` | Main runtime agent | Always |
| `START_ZAPAI.ps1` | Startup script | Alternative to manual startup |
| `server.js` | Main Express app | Spawned by agent |
| `services/runtimeManager.js` | ngrok health checks | Background monitoring |
| `services/activationConfirmationService.js` | PowerShell prompts | User confirmation |
| `controllers/systemController.js` | API endpoints | Route handling |
| `logs/runtime.log` | Event logging | Debugging |

## Next Steps

1. ✅ **Start Local Runtime Agent:**
   ```powershell
   node localRuntimeAgent.js
   ```

2. ✅ **Activate from Lovable:**
   - Open Lovable dashboard
   - Click "Activate System"
   - Confirm when PowerShell prompt appears

3. ✅ **Verify Connection:**
   - Check `GET /system/runtime/status`
   - Should show `ngrok: "connected"`

4. ✅ **Check Logs:**
   - View `logs/runtime.log`
   - Verify activation sequence

5. ✅ **Integrate Frontend:**
   - Use ngrok URL from logs
   - Implement polling via `useRuntimeConnection` hook
   - Test message flow

## Support

### Check Status
```powershell
curl http://127.0.0.1:4000/system/runtime/status
```

### View Recent Logs
```powershell
curl "http://127.0.0.1:4000/system/runtime/logs?limit=50" | ConvertFrom-Json | %{$_.logs} | ConvertTo-Json
```

### Stop System
```powershell
curl -X POST http://127.0.0.1:4000/system/stop
```

### Manual Restart
```powershell
# Kill existing
taskkill /IM node.exe /F
taskkill /IM ngrok.exe /F

# Restart agent
node localRuntimeAgent.js
```

---

**Version:** 1.0.0  
**Date:** March 16, 2026  
**Status:** ✅ Production Ready

**See Also:**
- [LOCAL_RUNTIME_AGENT.md](LOCAL_RUNTIME_AGENT.md) - Technical Reference
- [POWERSHELL_ACTIVATION_FLOW.md](POWERSHELL_ACTIVATION_FLOW.md) - Activation Details
- [FRONTEND_RECONNECTION.md](FRONTEND_RECONNECTION.md) - React Integration
- [API_REFERENCE.md](API_REFERENCE.md) - All Endpoints


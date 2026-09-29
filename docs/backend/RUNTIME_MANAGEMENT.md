# ZapFlow Runtime Management System - Complete Guide

## System Overview

The ZapFlow Runtime Management System ensures reliable remote connection between the Lovable React frontend and the local Node.js/Baileys WhatsApp server. It automatically manages process lifecycle, health checks, and reconnection without manual intervention.

## Complete Architecture

```
┌─────────────────────────────────┐
│   Lovable React Frontend        │
│   (HTTPS - Live)                │
└────────────────┬────────────────┘
                 │
                 │ Automatic Polling
                 │ Every 3 seconds
                 ▼
┌─────────────────────────────────────────────┐
│   Supabase Edge Function (API Proxy)        │
│   Forwards requests to ngrok tunnel         │
└──────┬────────────────────────────────────┬─┘
       │                                    │
       │ GET /system/runtime/status         │
       │ POST /system/activate             │
       │ Other API calls                    │
       │                                    │
       ▼                                    ▼
      ngrok tunnel                    ngrok tunnel
  (https://xxxx.ngrok-free.dev)  (auto-managed)
       ▲                                    ▲
       │                                    │
       └────────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Local Node.js Server         │
        │  Port: 4000                   │
        ├───────────────────────────────┤
        │  Controllers                  │
        │  - systemController.js        │
        │  - messagesController.js      │
        │  - etc.                       │
        ├───────────────────────────────┤
        │  Services                     │
        │  - runtimeManager.js ← KEY    │
        │  - sessionManager.js          │
        │  - whatsappService.js         │
        │  - etc.                       │
        ├───────────────────────────────┤
        │  Routes                       │
        │  - /system/*                  │
        │  - /messages/*                │
        │  - /sessions/*                │
        │  - etc.                       │
        └───────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ngrok Tunnel  Baileys    Database
   (managed by    WhatsApp   (PostgreSQL)
   runtimeManager) Engine
```

## Key Components

### 1. RuntimeManager Service

**File:** `services/runtimeManager.js`

**Responsibilities:**
- Manages ngrok tunnel lifecycle (start, stop, restart)
- Performs health checks every 5 seconds
- Auto-restarts ngrok on failure
- Exposes runtime status
- Logs all events

**Key Functions:**
```javascript
await runtimeManager.initialize(port)           // Start ngrok & monitoring
await runtimeManager.startNgrok(port)           // Start ngrok only
await runtimeManager.stopNgrok()                // Stop ngrok tunnel
runtimeManager.healthCheckNgrok()               // Manual health check
await runtimeManager.restartNgrok(port)         // Restart tunnel
runtimeManager.startMonitoring(port)            // Start 5s interval checks
runtimeManager.stopMonitoring()                 // Stop health checks
runtimeManager.getStatus()                      // Current status
runtimeManager.getDebugInfo()                   // Extended status
```

### 2. RuntimeLogger Service

**File:** `services/runtimeLogger.js`

**Responsibilities:**
- Logs runtime events (start, stop, restart, errors)
- Manages log file rotation (10MB limit)
- Provides log retrieval and filtering
- Keeps last 5000 entries

**Log Location:** `logs/runtime.log`

**Example Log Entry:**
```json
{
  "timestamp": "2026-03-16T10:30:00.123Z",
  "level": "info",
  "message": "ngrok tunnel connected",
  "url": "https://a1b2c3d.ngrok-free.dev"
}
```

### 3. System Controller

**File:** `controllers/systemController.js`

**New Endpoints:**
- `GET /system/runtime/status` - Current runtime status
- `GET /system/runtime/debug` - Debug information
- `POST /system/runtime/restart-ngrok` - Manual restart
- `GET /system/runtime/logs` - Recent logs
- `DELETE /system/runtime/logs` - Clear logs

### 4. Activation Service

**File:** `services/activationConfirmationService.js`

**Responsibilities:**
- Shows desktop confirmation dialog
- Executes startup script
- Tracks client IP for security

**Startup Scripts:**
- `scripts/start-runtime.bat` (Windows Batch)
- `scripts/start-runtime.ps1` (Windows PowerShell)

## Workflow Examples

### Scenario 1: System Startup

```
User starts server.js
    ↓
Server listens on port 4000
    ↓
runtimeManager.initialize() called
    ↓
startNgrok() spawns ngrok process
    ↓
ngrok waits for "client connection established"
    ↓
URL parsed and stored: https://xxxx.ngrok-free.dev
    ↓
startMonitoring() begins 5-second health checks
    ↓
Frontend polling starts: GET /system/runtime/status
    ↓
Frontend receives: {"runtime": "running", "ngrok": "connected"}
    ↓
System ready for WhatsApp messages
```

### Scenario 2: ngrok Crashes

```
RuntimeManager health check (5s interval)
    ↓
healthCheckNgrok() makes request to http://127.0.0.1:4040/api/tunnels
    ↓
Request fails (ngrok process dead)
    ↓
restartNgrok() called
    ↓
stopNgrok() kills any remaining process
    ↓
Wait 2 seconds
    ↓
startNgrok() launches new ngrok process
    ↓
New URL obtained and stored
    ↓
Frontend polls and gets new tunnel URL
    ↓
System handles requests on new tunnel
```

### Scenario 3: Frontend Connection Loss

```
Frontend polling: GET /system/runtime/status (every 3s)
    ↓
Frontend receives: {"runtime": "running", "ngrok": "disconnected"}
    ↓
Frontend shows: "Runtime Offline - Reconnecting..."
    ↓
Any pending requests queued
    ↓
Frontend continues polling
    ↓
LocalRuntimeManager restarts ngrok automatically
    ↓
Frontend's next poll succeeds
    ↓
Frontend shows: "Connected ✅"
    ↓
Queued requests processed
```

### Scenario 4: Manual Activation (Desktop Only)

```
Frontend button: "Activate System"
    ↓
POST /system/activate
    ↓
Server shows desktop confirmation dialog:
"ZapFlow Activation
 Do you want to start the system?
 [YES] [NO]"
    ↓
User clicks [YES]
    ↓
executeStartupScript() runs start-runtime.bat
    ↓
start-runtime.bat:
  - Confirms Node.js installed
  - Installs npm dependencies
  - Sets environment variables
  - Runs: node server.js
    ↓
Server starts
    ↓
runtimeManager initializes
    ↓
Frontend polling continuously
    ↓
Connects when ready
```

## Data Flow Diagrams

### Health Check Loop
```
Every 5 seconds:
┌─────────────────────────────────┐
│ healthCheckNgrok()              │
├─────────────────────────────────┤
│ 1. Check ngrokConnected flag    │
│ 2. GET http://127.0.0.1:4040    │
│ 3. Parse response               │
│ 4. Return true/false            │
└─────────────────────────────────┘
       │
       ├─→ [Healthy] → Reset attempt counter
       │
       └─→ [Unhealthy] → 
           Call restartNgrok() →
           Log event →
           Wait 2s →
           Start new process →
           Parse URL →
           Continue monitoring
```

### Frontend Polling Loop
```
Every 3 seconds (Browser):
┌──────────────────────────────┐
│ GET /system/runtime/status   │
├──────────────────────────────┤
│ Timeout: 5 seconds           │
│ Cache: No                    │
│ Retry: Forever               │
└──────────────────────────────┘
       │
       ├─→ [Connected] →
       │   - Update UI: "✅ Online"
       │   - Process queued requests
       │   - Continue polling
       │
       └─→ [Disconnected] →
           - Update UI: "⏳ Reconnecting..."
           - Queue new requests
           - Continue polling
           - Show overlay after 10s
```

## Status Codes

### Runtime Status
```javascript
{
  "runtime": "running",        // Node.js server status
  "ngrok": "connected",        // Tunnel status
  "port": 4000,
  "tunnel": "https://xxxx.ngrok-free.dev" // Public URL
}
```

### Possible Responses
```
runtime: "running" or "offline"
ngrok: "connected" or "disconnected"
```

## Configuration

### Environment Variables

```bash
# ngrok Configuration
NGROK_AUTH_TOKEN=your_token       # Optional; enables unlimited sessions
NGROK_PORT=4000                   # Tunnel port (default)

# Runtime Configuration  
NGROK_MANAGED_EXTERNALLY=false    # Set to true only if managing externally
NODE_ENV=production               # Set by startup scripts

# Server Configuration
PORT=4000                          # API port
```

### Runtime Configuration Constants

```javascript
// services/runtimeManager.js

CONFIG = {
  NGROK_HEALTH_CHECK_INTERVAL: 5000,    // 5 seconds
  NGROK_STARTUP_TIMEOUT: 10000,         // 10 seconds
  NGROK_PORT: 4000,
  MAX_RESTART_ATTEMPTS: 3,               // Max 3 consecutive failures
  RESTART_DELAY: 2000,                   // Wait 2 seconds before restart
}
```

## API Reference

### GET /system/runtime/status

Returns the current runtime and ngrok tunnel status.

**Request:**
```http
GET /system/runtime/status
Accept: application/json
```

**Response (Success):**
```json
{
  "runtime": "running",
  "ngrok": "connected",
  "port": 4000,
  "tunnel": "https://a1b2c3d4.ngrok-free.dev",
  "ngrokProcess": "active",
  "lastHealthCheck": "2026-03-16T10:30:15.123Z",
  "lastNgrokRestart": "2026-03-16T10:20:00.000Z",
  "ngrokRestartAttempts": 0
}
```

### GET /system/runtime/logs

Retrieves runtime logs.

**Request:**
```http
GET /system/runtime/logs?limit=100&level=error
Accept: application/json
```

**Query Parameters:**
- `limit` - Number of entries (default: 100)
- `level` - Filter by level: "info", "warn", "error" (optional)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2026-03-16T10:30:00.000Z",
      "level": "info",
      "message": "ngrok tunnel connected",
      "url": "https://xxxx.ngrok-free.dev"
    }
  ],
  "total": 1,
  "fileInfo": {
    "exists": true,
    "path": "/path/to/logs/runtime.log",
    "size": 1024,
    "sizeReadable": "1.00 KB",
    "modifiedAt": "2026-03-16T10:30:00.000Z"
  }
}
```

### POST /system/runtime/restart-ngrok

Manually restarts the ngrok tunnel.

**Request:**
```http
POST /system/runtime/restart-ngrok
Content-Type: application/json

{
  "port": 4000
}
```

**Response:**
```json
{
  "status": "restarting",
  "runtimeStatus": {
    "runtime": "running",
    "ngrok": "disconnected",
    "port": 4000,
    "tunnel": null
  },
  "message": "ngrok restart initiated"
}
```

### DELETE /system/runtime/logs

Clears all runtime logs.

**Request:**
```http
DELETE /system/runtime/logs
```

**Response:**
```json
{
  "message": "Runtime logs cleared"
}
```

## Monitoring Dashboard Example

```typescript
// RuntimeDashboard.tsx
import { useEffect, useState } from 'react';

export function RuntimeDashboard() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/system/runtime/status');
      setStatus(await res.json());

      const logsRes = await fetch('/system/runtime/logs?limit=20');
      setLogs((await logsRes.json()).logs);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg p-4">
        <h2 className="font-bold mb-2">Runtime Status</h2>
        <p>Runtime: {status?.runtime === 'running' ? '✅' : '❌'}</p>
        <p>ngrok: {status?.ngrok === 'connected' ? '✅' : '❌'}</p>
        <p>Tunnel: {status?.tunnel || 'N/A'}</p>
        <p>Port: {status?.port}</p>
      </div>

      <div className="bg-white rounded-lg p-4">
        <h2 className="font-bold mb-2">Recent Logs</h2>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <p key={log.timestamp} className="text-sm font-mono">
              [{log.level}] {log.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Logging

### Log Files

| File | Purpose | Rotation |
|------|---------|----------|
| `logs/runtime.log` | Runtime events, ngrok, health checks | 10 MB → auto-rotate |
| `logs/activation_log.json` | System activation requests with IPs | Last 1000 entries |
| `logs/runtime_errors.log` | System errors | Last 100 entries |

### Log Levels

- **info** - Normal operations (startup, health check pass)
- **warn** - Warnings (restart attempt, health check fail)
- **error** - Errors (crash, failed restart)

### Viewing Logs

```bash
# Real-time runtime log
tail -f logs/runtime.log

# Recent 50 errors
curl http://localhost:4000/system/runtime/logs?level=error&limit=50

# All logs
curl http://localhost:4000/system/runtime/logs?limit=1000
```

## Troubleshooting

### Issue: ngrok tunnel keeps restarting

**Symptoms:**
- `ERR_NGROK_3200` errors intermittent
- Tunnel URL changes frequently
- Logs show constant restarts

**Solutions:**
1. Check ngrok auth token: `echo $NGROK_AUTH_TOKEN`
2. Check network stability: `ping 1.1.1.1`
3. Verify ngrok is installed: `ngrok --version`
4. Increase health check timeout in config
5. Check firewall: `netstat -an | grep 4000`

### Issue: "ngrok: command not found"

**Symptoms:**
- RuntimeManager exits immediately
- Error in logs: "ngrok is not installed"

**Solutions:**
1. Install ngrok: `npm install -g ngrok`
2. Or download from https://ngrok.com/download
3. Verify PATH: `where ngrok` (Windows) or `which ngrok` (Mac/Linux)

### Issue: Frontend never reconnects

**Symptoms:**
- Polling at 3s intervals continues
- Status stays "disconnected"
- RuntimeManager shows healthy ngrok

**Solutions:**
1. Check CORS settings in server.js
2. Verify frontend API base URL is correct
3. Check browser console for network errors
4. Verify ngrok tunnel is actually running: `curl http://127.0.0.1:4040/api/tunnels`

### Issue: Port 4000 already in use

**Symptoms:**
- Server fails to start
- Error: "EADDRINUSE"

**Solutions:**
1. Find process on port 4000: `netstat -ano | findstr :4000`
2. Kill it: `taskkill /PID <PID> /F`
3. Or set different port: `PORT=5000 npm start`

## Performance and Limits

| Metric | Value | Notes |
|--------|-------|-------|
| Health Check Interval | 5 seconds | Minimum time to detect failure |
| Frontend Poll Interval | 3 seconds | Recommended in frontend |
| ngrok Startup Timeout | 10 seconds | Time to establish tunnel |
| Max Restart Attempts | 3 | Before leaving ngrok offline |
| Log File Max Size | 10 MB | Rotates automatically |
| Log File Entries | Last 5000 | Older ones discarded |
| Queue Size (Frontend) | Unlimited | Consider implementing limit |

## Security Considerations

### 1. Authentication
- ✅ IP logging for activation requests
- ⚠️ No API key authentication on status endpoint (consider adding)

### 2. Network
- ✅ ngrok provides HTTPS tunnel
- ✅ CORS validation for frontend requests
- ⚠️ Ensure NGROK_AUTH_TOKEN is kept secret

### 3. Local Confirmation
- ✅ Desktop dialog required for activation
- ✅ No automatic startup
- ✅ All activations logged with IP

## Future Improvements

- [ ] Add authentication tokens to /system/* endpoints
- [ ] Implement request rate limiting
- [ ] Add webhook notifications on events
- [ ] Create web dashboard for remote monitoring
- [ ] Implement ngrok failover to backup tunnel providers
- [ ] Add metrics collection (uptime, restart frequency)
- [ ] Support multiple ngrok regions
- [ ] Implement automatic log cleanup
- [ ] Add email alerts for repeated failures

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-16 | Initial release - RuntimeManager with health checks |

---

**Last Updated:** March 16, 2026  
**Maintained By:** ZapFlow Development Team  
**Support:** Check logs/runtime.log for detailed information

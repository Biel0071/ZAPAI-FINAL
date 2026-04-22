# Local Runtime Agent - Implementation Guide

## Overview

`localRuntimeAgent.js` is a standalone Node.js application that runs on the user's computer and listens for activation requests from the Lovable frontend. It manages the local runtime (Node.js server) and ngrok tunnel automatically.

## Architecture

```
Lovable Frontend (HTTPS)
  ↓
Supabase Edge Function (Proxy)
  ↓
ngrok tunnel (Public URL)
  ↓
Local Runtime Agent (127.0.0.1:4000)
  ├─ Node.js Runtime Server (4000)
  └─ ngrok Tunnel Management
```

## Quick Start

### 1. Run the Agent

```bash
node localRuntimeAgent.js
```

Output:
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

### 2. Activate from Frontend

Frontend makes request:
```javascript
POST /system/activate HTTP/1.1
Host: localhost:4000
Content-Type: application/json
```

Agent responds:
```json
{
  "status": "starting",
  "message": "Runtime and ngrok tunnel starting",
  "ngrok": "https://xxxx.ngrok-free.dev"
}
```

### 3. Check Status

Frontend polls:
```javascript
GET /system/runtime/status HTTP/1.1
Host: localhost:4000
```

Response:
```json
{
  "runtime": "running",
  "ngrok": "connected",
  "ngrokURL": "https://xxxx.ngrok-free.dev",
  "nodePID": 12345,
  "ngrokPID": 12346,
  "uptime": "2026-03-16T10:30:00.000Z"
}
```

## API Endpoints

### POST /system/activate

**Purpose:** Start the local runtime and ngrok tunnel

**Request:**
```http
POST /system/activate HTTP/1.1
Host: localhost:4000
Content-Type: application/json
```

**Response (Success):**
```json
{
  "status": "starting",
  "message": "Runtime and ngrok tunnel starting",
  "ngrok": "https://xxxx.ngrok-free.dev"
}
```

**Response (Already Running):**
```json
{
  "status": "already_running",
  "message": "Runtime already running",
  "ngrok": "https://xxxx.ngrok-free.dev"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to start runtime: [error details]"
}
```

**Status Codes:**
- `200` - Runtime started or already running
- `409` - Another instance already running
- `500` - Failed to start runtime

---

### GET /system/runtime/status

**Purpose:** Poll current runtime and ngrok status

**Request:**
```http
GET /system/runtime/status HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "runtime": "running|stopped",
  "ngrok": "connected|connecting|offline",
  "ngrokURL": "https://xxxx.ngrok-free.dev",
  "nodePID": 12345,
  "ngrokPID": 12346,
  "uptime": "2026-03-16T10:30:00.000Z"
}
```

**Status Values:**
- `runtime`: `running` (server started) | `stopped` (server down)
- `ngrok`: `connected` (tunnel active) | `connecting` (starting) | `offline` (not running)

---

### GET /system/runtime/logs

**Purpose:** Retrieve recent runtime logs

**Request:**
```http
GET /system/runtime/logs?limit=100 HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**
- `limit` (optional) - Number of recent logs to return (default: 100)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2026-03-16T10:30:00.000Z",
      "level": "info",
      "message": "Activation request received",
      "ip": "192.168.1.100",
      "action": "activation_requested",
      "status": "pending"
    },
    {
      "timestamp": "2026-03-16T10:30:01.000Z",
      "level": "info",
      "message": "Node.js runtime started",
      "action": "startup_sequence",
      "nodePID": 12345
    }
  ]
}
```

---

### POST /system/stop

**Purpose:** Manually stop runtime and ngrok

**Request:**
```http
POST /system/stop HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "status": "stopped",
  "message": "Runtime and ngrok tunnel stopped"
}
```

---

### GET /health

**Purpose:** Health check endpoint

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-16T10:30:00.000Z"
}
```

## Features

### 1. Multiple Instance Prevention

The agent prevents multiple runtime instances from running simultaneously:

```javascript
// Lock file at logs/runtime.lock
{
  "pid": 12345,
  "timestamp": "2026-03-16T10:30:00.000Z"
}
```

**Behavior:**
- When agent starts, creates lock file
- If lock file exists, checks if PID still running
- If PID not found, removes stale lock and continues
- New activation requests check lock file
- Responds with 409 Conflict if another instance running

### 2. Automatic ngrok Health Checks

Health check loop runs every 5 seconds:

```javascript
NGROK_HEALTH_CHECK_INTERVAL = 5000 // milliseconds
```

**Checks:**
- Queries `http://127.0.0.1:4040/api/tunnels`
- Validates ngrok tunnel is connected
- If tunnel down, attempts restart (max 3 times)
- Logs all failures and reconnections

### 3. Graceful Process Management

Processes spawned as detached:
```javascript
spawn('node', ['server.js'], {
  detached: true,        // Independent of parent
  stdio: 'ignore',       // Don't inherit I/O
  windowsHide: true      // Hide on Windows
})
```

**Benefits:**
- Agent can restart without killing runtime
- Runtime continues running independently
- Clean shutdown via lock file
- Signal handling (SIGINT, SIGTERM)

### 4. Comprehensive Logging

All events logged to `logs/runtime.log`:

```json
{
  "timestamp": "2026-03-16T10:30:00.000Z",
  "level": "info|warn|error",
  "message": "descriptive message",
  "ip": "192.168.1.100",
  "action": "activation_requested|startup_sequence|ngrok_startup",
  "status": "pending|success|error|already_running",
  "error": "error message (if error)",
  "nodePID": 12345,
  "ngrokPID": 12346
}
```

**Log Levels:**
- `info` - Startup, status updates, successful operations
- `warn` - ngrok down, reconnection attempts
- `error` - Failed operations, exceptions

### 5. Process Sequencing

Startup sequence is carefully timed:

1. **Receive activation request** (T+0ms)
2. **Start Node.js server** (T+0ms)
3. **Wait for server startup** (T+1000ms)
4. **Start ngrok tunnel** (T+3000ms)
5. **Wait for ngrok connection** (T+3500-4500ms)
6. **Return success response** (T+4500ms)
7. **Begin health check loop** (T+5000ms)

**Timing Rationale:**
- 1s delay allows Node.js to initialize
- 3s delay allows server to listen before ngrok connects
- Health checks every 5s catch issues quickly

### 6. Client IP Tracking

Request source logged for audit trail:

```javascript
IP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
   || req.headers['x-real-ip']
   || req.connection?.remoteAddress
   || 'unknown'
```

**Log Entry:**
```json
{
  "timestamp": "2026-03-16T10:30:00.000Z",
  "ip": "203.0.113.45",
  "action": "activation_requested",
  "userResponse": "YES"
}
```

## State Management

### RuntimeState Object

```javascript
runtimeState = {
  nodeProcess: Process | null,
  ngrokProcess: Process | null,
  nodePID: number | null,
  ngrokPID: number | null,
  runtimeRunning: boolean,
  ngrokRunning: boolean,
  ngrokURL: string | null,
  restartAttempts: number,
  lastHealthCheck: string | null,
  healthCheckInterval: NodeJS.Timer | null
}
```

**Key Methods:**

- `isRuntimeRunning()` - True if Node.js server running
- `isNgrokConnected()` - True if ngrok tunnel active
- `createLockFile()` - Prevent multiple instances
- `removeLockFile()` - Cleanup on shutdown
- `isAnotherInstanceRunning()` - Check for duplicate agents

## Error Handling

### Error Scenarios

**1. Port Already in Use**
```json
{
  "status": "error",
  "message": "Failed to start runtime: Port 4000 already in use"
}
```

**2. Node.js Not Found**
```json
{
  "status": "error",
  "message": "Failed to start runtime: ENOENT - node executable not found"
}
```

**3. ngrok Not Installed**
```json
{
  "status": "error",
  "message": "Failed to start runtime: ENOENT - ngrok executable not found"
}
```

**4. ngrok Tunnel Timeout**
```json
{
  "status": "starting",
  "message": "Runtime and ngrok tunnel starting"
}
// Later: ngrok connection fails
// Log: "ngrok tunnel failed to connect"
// Status endpoint returns: ngrok: "offline"
```

**5. Another Instance Running**
```json
{
  "status": "already_running",
  "message": "Runtime is already running"
}
```

## Usage Patterns

### Pattern 1: Frontend Activation

```javascript
// Frontend code
async function activateSystem() {
  try {
    const res = await fetch('/system/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (data.status === 'starting') {
      // Begin polling status
      pollUntilConnected();
    } else if (data.status === 'already_running') {
      // Already started
      showConnectedUI();
    } else {
      // Error
      showError(data.message);
    }
  } catch (error) {
    showError(`Connection failed: ${error.message}`);
  }
}

// Poll until connected
async function pollUntilConnected() {
  let attempts = 0;
  const maxAttempts = 60; // 60 seconds

  const interval = setInterval(async () => {
    try {
      const res = await fetch('/system/runtime/status');
      const status = await res.json();

      if (status.ngrok === 'connected') {
        showConnectedUI(status.ngrokURL);
        clearInterval(interval);
      }
    } catch (e) {
      attempts++;
    }

    if (attempts >= maxAttempts) {
      showError('System startup timeout');
      clearInterval(interval);
    }
  }, 1000);
}
```

### Pattern 2: Status Monitoring

```javascript
// Monitor agent health
const healthMonitor = setInterval(async () => {
  try {
    const res = await fetch('/health');
    if (res.ok) {
      console.log('✅ Agent healthy');
    }
  } catch (error) {
    console.error('❌ Agent unreachable');
    // Notify user
  }
}, 30000); // Every 30 seconds
```

### Pattern 3: Log Retrieval

```javascript
// Fetch recent logs for debugging
async function fetchRecentLogs(limit = 50) {
  const res = await fetch(`/system/runtime/logs?limit=${limit}`);
  const data = await res.json();

  data.logs.forEach((log) => {
    console.log(`[${log.level}] ${log.message}`, log);
  });
}
```

## Configuration

### Constants (src/localRuntimeAgent.js)

```javascript
PORT = 4000                           // HTTP server port
LOG_DIR = './logs'                    // Log directory
NGROK_HEALTH_CHECK_INTERVAL = 5000   // 5 seconds
STARTUP_DELAY = 3000                 // 3 seconds before ngrok
MAX_RESTART_ATTEMPTS = 3              // Max ngrok restarts
NGROK_API_URL = 'http://127.0.0.1:4040/api/tunnels'
```

### Environment Variables (Optional)

```bash
# Port for Node.js server (default: 4000)
export PORT=4000

# ngrok region (optional)
export NGROK_REGION=us
```

## File Structure

```
localRuntimeAgent.js          # Main agent file (this)
├─ Configuration              # Top section
├─ Utility Functions          # Logging, IP extraction
├─ RuntimeState Class         # State management
├─ Process Management         # Start/stop functions
├─ Express Setup              # API endpoints
├─ Server Startup             # Main entry point
└─ Exports                    # Module exports

logs/
├─ runtime.log               # Event log (JSON lines)
├─ ngrok_url.json            # Current tunnel URL
└─ runtime.lock              # Process lock file (PID)
```

## Deployment

### Option 1: Standalone Agent (Separate Process)

Run agent independently:
```bash
# Terminal 1: Run agent
node localRuntimeAgent.js

# Terminal 2: Run main server (if needed)
npm start
```

### Option 2: Embedded in Startup Script

```powershell
# START_ZAPAI.ps1
Start-Process -FilePath "node.exe" -ArgumentList "localRuntimeAgent.js"
```

### Option 3: Windows Service

Install as Windows service:
```bash
npm install -g nssm
nssm install ZapFlowAgent node C:\path\to\localRuntimeAgent.js
nssm start ZapFlowAgent
```

### Option 4: Linux Systemd

Create `/etc/systemd/system/zapflow-agent.service`:
```ini
[Unit]
Description=ZapFlow Local Runtime Agent
After=network.target

[Service]
Type=simple
User=zapflow
WorkingDirectory=/home/zapflow/app
ExecStart=/usr/bin/node /home/zapflow/app/localRuntimeAgent.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable zapflow-agent
sudo systemctl start zapflow-agent
```

## Troubleshooting

### Agent Won't Start

**Error:** `ENOENT - node executable not found`
```bash
# Solution: Ensure Node.js in PATH
echo $PATH | grep node
node --version
```

**Error:** `Port 4000 already in use`
```bash
# Solution: Kill process on port 4000
# Windows:
netstat -ano | find ":4000"
taskkill /PID <PID> /F

# Linux:
lsof -i :4000
kill -9 <PID>
```

### ngrok Won't Connect

**Error:** `ngrok tunnel failed to connect`

```bash
# Check ngrok installed:
ngrok --version

# Check ngrok auth token (if using auth):
ngrok config list

# Test ngrok manually:
ngrok http 4000
```

### Agent Crashes

**Check logs:**
```bash
tail -f logs/runtime.log
cat logs/runtime.log | grep -i error
```

**Common issues:**
- Server.js has syntax errors
- ngrok tunnel fails
- Orphaned processes occupying port 4000

**Solution:**
1. Check `logs/runtime.log` for errors
2. Run `npm start` manually to test
3. Check server.js syntax: `node -c server.js`
4. Kill orphaned processes: `taskkill /F /IM ngrok.exe`

### Multiple Instances

**Error:** `409 - Another instance already running`

**Solution:**
```bash
1. Delete lock file:
   rm logs/runtime.lock

2. Kill existing processes:
   taskkill /IM node.exe /F
   taskkill /IM ngrok.exe /F

3. Restart agent:
   node localRuntimeAgent.js
```

## Security Considerations

### 1. Local Network Only

Agent listens on `127.0.0.1:4000`:
- Only local machine can access directly
- Remote requests must tunnel through ngrok
- ngrok provides auto-HTTPS and authentication

### 2. Process Management

- Processes run as user running agent
- No privilege escalation needed
- Graceful shutdown with lock file
- No hardcoded credentials

### 3. Logging

- All requests logged with IP address
- No passwords or tokens logged
- Log file rotated automatically
- Access control via file permissions

### 4. Limitations

- Requires local user presence
- No rate limiting (add in reverse proxy)
- No authentication middleware
- Consider adding API key validation

## Monitoring & Operations

### Health Check Commands

```bash
# Check if agent running
curl http://127.0.0.1:4000/health

# Get runtime status
curl http://127.0.0.1:4000/system/runtime/status

# Get recent logs
curl "http://127.0.0.1:4000/system/runtime/logs?limit=50"

# Manual stop
curl -X POST http://127.0.0.1:4000/system/stop
```

### Log Monitoring

```bash
# Watch logs in real-time
tail -f logs/runtime.log

# Filter by level
cat logs/runtime.log | grep '"info"'
cat logs/runtime.log | grep '"error"'

# Count log entries
wc -l logs/runtime.log

# Find ngrok connections
cat logs/runtime.log | grep "ngrok_startup"
```

### Performance Metrics

```bash
# Check current ngrok URL
cat logs/ngrok_url.json

# Check process IDs
cat logs/runtime.lock

# Monitor memory usage (Windows)
Get-Process | Where-Object {$_.ProcessName -eq 'node'}
```

## Testing Checklist

- [ ] Agent starts without errors
- [ ] Agent listens on 127.0.0.1:4000
- [ ] Health endpoint responds
- [ ] POST /system/activate starts processes
- [ ] GET /system/runtime/status returns correct values
- [ ] ngrok tunnel connects and URL is valid
- [ ] Lock file prevents duplicate instances
- [ ] Logs created in logs/runtime.log
- [ ] ngrok health checks run every 5 seconds
- [ ] Manual restart works via POST /system/stop
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] ngrok auto-restarts on failure

## References

- [Node.js child_process Documentation](https://nodejs.org/api/child_process.html)
- [Express.js API Reference](https://expressjs.com/en/api.html)
- [ngrok Tunnel Documentation](https://ngrok.com/docs)
- [HTTP Status Codes](https://httpwg.org/specs/rfc7231.html#status.codes)

---

**Version:** 1.0.0  
**Date:** March 16, 2026  
**Status:** ✅ Production Ready


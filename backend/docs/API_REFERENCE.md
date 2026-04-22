# ZapFlow API Reference - All Endpoints

## Runtime Management Endpoints (New)

### GET /system/runtime/status
**Purpose:** Get real-time runtime and ngrok tunnel status (use for frontend polling)

**Request:**
```http
GET /system/runtime/status HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response (Connected):**
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

**Response (Disconnected):**
```json
{
  "runtime": "running",
  "ngrok": "disconnected",
  "port": 4000,
  "tunnel": null,
  "ngrokProcess": "inactive",
  "lastHealthCheck": "2026-03-16T10:30:10.000Z",
  "lastNgrokRestart": "2026-03-16T10:25:00.000Z",
  "ngrokRestartAttempts": 1
}
```

**Status Codes:**
- `200` - Status retrieved successfully
- `500` - Error retrieving status

**Frontend Integration:**
```javascript
const runtime = await fetch('/system/runtime/status').then(r => r.json());
if (runtime.ngrok === 'connected') {
  // Safe to use tunnel
} else {
  // Queue requests, show reconnecting overlay
}
```

---

### GET /system/runtime/debug
**Purpose:** Get extended debug information for troubleshooting

**Request:**
```http
GET /system/runtime/debug HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response:**
```json
{
  "runtime": "running",
  "ngrok": "connected",
  "port": 4000,
  "tunnel": "https://a1b2c3d4.ngrok-free.dev",
  "ngrokProcess": "active",
  "lastHealthCheck": "2026-03-16T10:30:15.123Z",
  "lastNgrokRestart": "2026-03-16T10:20:00.000Z",
  "ngrokRestartAttempts": 0,
  "isMonitoring": true,
  "config": {
    "NGROK_PORT": 4000,
    "NGROK_HEALTH_CHECK_INTERVAL": 5000,
    "NGROK_STARTUP_TIMEOUT": 10000,
    "MAX_RESTART_ATTEMPTS": 3
  }
}
```

**Usage:**
```bash
curl http://localhost:4000/system/runtime/debug | jq
```

---

### POST /system/runtime/restart-ngrok
**Purpose:** Manually restart the ngrok tunnel

**Request:**
```http
POST /system/runtime/restart-ngrok HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "port": 4000
}
```

**Response (Success):**
```json
{
  "status": "restarting",
  "runtimeStatus": {
    "runtime": "running",
    "ngrok": "disconnected",
    "port": 4000,
    "tunnel": null,
    "ngrokProcess": "inactive",
    "lastHealthCheck": "2026-03-16T10:30:15.123Z",
    "lastNgrokRestart": "2026-03-16T10:30:20.000Z",
    "ngrokRestartAttempts": 1
  },
  "message": "ngrok restart initiated"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to restart ngrok"
}
```

**Status Codes:**
- `200` - Restart initiated
- `500` - Error during restart

**Usage:**
```bash
# Manually trigger ngrok restart
curl -X POST http://localhost:4000/system/runtime/restart-ngrok \
  -H "Content-Type: application/json" \
  -d '{"port": 4000}'
```

---

### GET /system/runtime/logs
**Purpose:** Retrieve runtime logs (filtered by level if needed)

**Request:**
```http
GET /system/runtime/logs?limit=100&level=error HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Query Parameters:**
- `limit` (optional) - Number of entries to return (default: 100)
- `level` (optional) - Filter by log level: "info", "warn", "error"

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2026-03-16T10:30:00.000Z",
      "level": "info",
      "message": "ngrok tunnel connected",
      "url": "https://a1b2c3d4.ngrok-free.dev"
    },
    {
      "timestamp": "2026-03-16T10:30:05.000Z",
      "level": "info",
      "message": "ngrok health check passed"
    },
    {
      "timestamp": "2026-03-16T10:30:11.000Z",
      "level": "warn",
      "message": "ngrok health check failed",
      "willRestart": true
    },
    {
      "timestamp": "2026-03-16T10:30:12.000Z",
      "level": "info",
      "message": "Restarting ngrok tunnel",
      "attempt": 1,
      "maxAttempts": 3
    }
  ],
  "total": 4,
  "fileInfo": {
    "exists": true,
    "path": "c:\\path\\to\\logs\\runtime.log",
    "size": 2048,
    "sizeReadable": "2.00 KB",
    "modifiedAt": "2026-03-16T10:30:15.000Z"
  }
}
```

**Status Codes:**
- `200` - Logs retrieved successfully
- `500` - Error retrieving logs

**Usage Examples:**
```bash
# Get last 50 logs
curl "http://localhost:4000/system/runtime/logs?limit=50"

# Get only error logs
curl "http://localhost:4000/system/runtime/logs?level=error"

# Get last 20 warnings
curl "http://localhost:4000/system/runtime/logs?limit=20&level=warn"

# Pretty print with jq
curl "http://localhost:4000/system/runtime/logs" | jq '.logs | .[-5:]'
```

---

### DELETE /system/runtime/logs
**Purpose:** Clear all runtime logs

**Request:**
```http
DELETE /system/runtime/logs HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "message": "Runtime logs cleared"
}
```

**Status Codes:**
- `200` - Logs cleared successfully
- `500` - Error clearing logs

**Usage:**
```bash
curl -X DELETE http://localhost:4000/system/runtime/logs
```

---

## Activation Endpoints

### POST /system/activate
**Purpose:** Request system activation with desktop confirmation

**Request:**
```http
POST /system/activate HTTP/1.1
Host: localhost:4000
Content-Type: application/json
```

**Response (User Confirms - YES):**
```json
{
  "status": "starting",
  "message": "System activation confirmed and startup script executed"
}
```

**Response (User Cancels - NO):**
```json
{
  "status": "cancelled",
  "message": "Activation cancelled by user"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to execute startup script"
}
```

**Status Codes:**
- `200` - Activation request handled (may be starting or cancelled)
- `500` - Error during activation process

**Security Features:**
- Shows desktop dialog (only works on machine running server)
- 30-second timeout (defaults to NO if user doesn't respond)
- Logs all activation attempts with IP address
- Timestamp recorded for audit trail

**Frontend Flow:**
```javascript
async function activateSystem() {
  const response = await fetch('/system/activate', { method: 'POST' });
  const data = await response.json();

  if (data.status === 'starting') {
    // Poll status until running
    pollStatus();
  } else if (data.status === 'cancelled') {
    // User rejected
    showMessage('User declined activation');
  } else {
    // Error
    showError(data.message);
  }
}
```

---

### GET /system/activation-logs
**Purpose:** Retrieve activation request history with security details

**Request:**
```http
GET /system/activation-logs?limit=50 HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Query Parameters:**
- `limit` (optional) - Number of entries to return (default: 50, max: 1000)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2026-03-16T10:25:00.000Z",
      "ip": "192.168.1.100",
      "action": "activation_requested",
      "userResponse": "YES",
      "status": "success"
    },
    {
      "timestamp": "2026-03-16T10:20:00.000Z",
      "ip": "192.168.1.101",
      "action": "activation_requested",
      "userResponse": "NO",
      "status": "cancelled"
    },
    {
      "timestamp": "2026-03-16T10:15:00.000Z",
      "ip": "192.168.1.100",
      "action": "startup_script",
      "userResponse": "YES",
      "status": "error",
      "error": "Startup script failed"
    }
  ],
  "total": 3
}
```

**Status Codes:**
- `200` - Logs retrieved successfully
- `500` - Error retrieving logs

**Audit Information Captured:**
- Timestamp (ISO 8601)
- Client IP address
- User response (YES/NO)
- Outcome (success/error/cancelled)
- Error messages if applicable

**Usage:**
```bash
# Get recent activations
curl "http://localhost:4000/system/activation-logs"

# Get last 100 activations
curl "http://localhost:4000/system/activation-logs?limit=100"

# Check who activated recently
curl "http://localhost:4000/system/activation-logs" | jq '.logs | sort_by(.timestamp) | last'
```

---

## Standard System Endpoints (Existing)

### GET /system/status
**Purpose:** Get full system status (Baileys, database, AI, sessions, etc.)

**Request:**
```http
GET /system/status HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response:**
```json
{
  "aiEngine": "healthy",
  "campaignQueue": "stopped",
  "database": "connected",
  "metrics": {
    "averageResponseTime": 250,
    "messagesProcessed": 1024,
    "errorCount": 3
  },
  "microtaskRunner": "running",
  "sessions": {
    "connected": 1,
    "total": 1
  },
  "socket": "connected",
  "whatsapp": {
    "connected": true
  }
}
```

---

### POST /system/start
**Purpose:** Start the ZapFlow system

**Request:**
```http
POST /system/start HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "restoredSessions": [...],
  "aiEngine": "healthy",
  "database": "connected",
  "socket": "connected"
}
```

---

### POST /system/stop
**Purpose:** Stop the ZapFlow system

**Request:**
```http
POST /system/stop HTTP/1.1
Host: localhost:4000
```

**Response:**
```json
{
  "aiEngine": "disabled",
  "database": "disconnected",
  "socket": "disconnected"
}
```

---

### GET /system/error-log
**Purpose:** Retrieve runtime error log

**Request:**
```http
GET /system/error-log HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response:**
```json
{
  "entries": [
    {
      "timestamp": "2026-03-16T10:30:00.000Z",
      "type": "error",
      "message": "Connection failed"
    }
  ],
  "logFile": "logs/runtime_errors.log"
}
```

---

### GET /system/ai-diagnostics
**Purpose:** Run AI system diagnostics

**Request:**
```http
GET /system/ai-diagnostics HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response:**
```json
{
  "aiStatus": "healthy",
  "responseTime": 250,
  "errorsDetected": 0,
  "lastAnalysis": "2026-03-16T10:30:00.000Z"
}
```

---

## Quick Reference Table

| Method | Endpoint | Purpose | Frontend Use |
|--------|----------|---------|---|
| GET | `/system/runtime/status` | ⭐ Check ngrok/runtime status | Poll every 3s |
| GET | `/system/runtime/logs` | View runtime logs | Debugging |
| DELETE | `/system/runtime/logs` | Clear runtime logs | Admin only |
| POST | `/system/runtime/restart-ngrok` | Manually restart ngrok | Emergency fixes |
| GET | `/system/runtime/debug` | Extended debug info | Troubleshooting |
| POST | `/system/activate` | Request system activation | Activation flow |
| GET | `/system/activation-logs` | View activation history | Audit & review |
| GET | `/system/status` | Full system status | General status |
| POST | `/system/start` | Start system | System control |
| POST | `/system/stop` | Stop system | System control |
| GET | `/system/error-log` | Error log | Error review |
| GET | `/system/ai-diagnostics` | Run AI diagnostics | AI debugging |

---

## Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Status retrieved, logs returned |
| 400 | Bad request | Invalid parameters |
| 404 | Not found | Endpoint doesn't exist |
| 500 | Server error | Process failure, log exception |

---

## Error Handling

### Common Error Responses

**ngrok Not Running:**
```json
{
  "error": "Failed to restart ngrok",
  "message": "ngrok process exited unexpectedly"
}
```

**Port Already in Use:**
```json
{
  "error": "internal_error",
  "message": "Port 4000 is already in use"
}
```

**Permission Denied:**
```json
{
  "error": "request_error",
  "message": "Insufficient permissions to access resource"
}
```

---

## Rate Limiting (Recommended Future)

Currently no rate limiting. Consider implementing:
- Status endpoint: No limit (frequently polled)
- Restart endpoint: Max 5 per minute
- Activation endpoint: Max 10 per hour
- Log endpoints: Max 30 per minute

---

## Authentication (Recommended Future)

Endpoints should ideally require Bearer token:
```http
GET /system/runtime/status HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Monitoring Examples

### Monitor System Health (Every 60s)
```bash
watch -n 60 'curl -s http://localhost:4000/system/runtime/status | jq .ngrok'
```

### Alert on Failures (Every 5s)
```bash
while true; do
  STATUS=$(curl -s http://localhost:4000/system/runtime/status | jq -r .ngrok)
  if [ "$STATUS" != "connected" ]; then
    echo "ALERT: ngrok is $STATUS at $(date)"
  fi
  sleep 5
done
```

### Log Recent Errors
```bash
curl -s "http://localhost:4000/system/runtime/logs?level=error&limit=10" | jq .logs
```

---

**Version:** 1.0.0  
**Last Updated:** March 16, 2026  
**Framework:** Node.js Express

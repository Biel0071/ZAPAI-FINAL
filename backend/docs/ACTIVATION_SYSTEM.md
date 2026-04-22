# ZapFlow Activation System Documentation

## Overview

The ZapFlow Activation System provides a secure, user-confirmed startup mechanism for the local Node.js runtime. When a user clicks "Activate System" in the Lovable React interface, the system displays a desktop confirmation dialog before starting the runtime.

## Architecture

```
┌─────────────────┐
│ Lovable UI      │
│ (React App)     │
└────────┬────────┘
         │ POST /system/activate
         ▼
┌─────────────────────────────┐
│ Local Node.js Runtime       │
│ (apiServer:4000)            │
├─────────────────────────────┤
│ 1. Receive activation req    │
│ 2. Show desktop dialog       │
│ 3. Wait for user response    │
└────────┬────────┬───────────┘
         │        │
      YES│        │NO
         ▼        ▼
   ┌─────────┐ ┌─────────┐
   │ Startup │ │ Reject  │
   │ Script  │ │ Request │
   └─────────┘ └─────────┘
```

## Flow Diagram

### 1. Activation Request
- Frontend sends: `POST /system/activate`
- Local runtime receives request from Lovable interface

### 2. Desktop Confirmation Dialog
- System shows native OS dialog with message:
  ```
  ZapFlow Activation
  
  Activation requested.
  Do you want to start the system?
  
  [YES] [NO]
  ```
- Dialog timeout: 30 seconds (defaults to NO if no response)
- The local user must manually interact with the dialog

### 3. User Response Handling

**If User Clicks YES:**
- Startup script executes (`start-runtime.bat` or `start-runtime.ps1`)
- Node.js server starts
- ngrok tunnel initializes
- Baileys sessions initialize
- Returns: `{"status": "starting"}`

**If User Clicks NO:**
- No startup occurs
- Returns: `{"status": "cancelled"}`

### 4. Frontend Polling
- Frontend polls `GET /system/status` until:
  ```json
  {
    "status": "running",
    "socket": "connected",
    "database": "connected",
    ...
  }
  ```

## API Endpoints

### POST /system/activate
Requests system activation with local user confirmation.

**Request:**
```bash
POST http://localhost:4000/system/activate
```

**Response (User Clicks YES):**
```json
{
  "status": "starting",
  "message": "System activation confirmed and startup script executed"
}
```

**Response (User Clicks NO):**
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

### GET /system/status
Polls current system status.

**Request:**
```bash
GET http://localhost:4000/system/status
```

**Response:**
```json
{
  "status": "running",
  "socket": "connected",
  "database": "connected",
  "aiEngine": "healthy",
  "whatsapp": {
    "connected": true
  },
  "sessions": {
    "connected": 1,
    "total": 1
  }
}
```

### GET /system/activation-logs
Retrieves recent activation logs.

**Request:**
```bash
GET http://localhost:4000/system/activation-logs?limit=50
```

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2026-03-16T10:30:00.000Z",
      "ip": "192.168.1.100",
      "action": "activation_requested",
      "userResponse": "YES",
      "status": "success"
    },
    {
      "timestamp": "2026-03-16T10:29:00.000Z",
      "ip": "192.168.1.100",
      "action": "activation_requested",
      "userResponse": "NO",
      "status": "cancelled"
    }
  ],
  "total": 2
}
```

## Security Features

### 1. Required Local Confirmation
- ✅ System NEVER starts without explicit user confirmation
- ✅ Desktop dialog requires local interaction
- ✅ 30-second timeout prevents indefinite waiting

### 2. Request Logging
- ✅ All activation requests are logged with:
  - Timestamp (ISO 8601 format)
  - Client IP address
  - User response (YES/NO)
  - Action result (success/error/cancelled)
  - Error messages (if applicable)

### 3. Audit Trail
- Location: `logs/activation_log.json`
- Keeps last 1000 entries
- Accessible via `GET /system/activation-logs`

### 4. IP Tracking
- Client IP extracted from request headers
- Supports X-Forwarded-For header for proxied requests
- Fallback to socket remote address

## Implementation Files

### Core Services

#### `services/activationConfirmationService.js`
- `showConfirmationDialog()` - Shows native OS notification dialog
- `executeStartupScript()` - Runs startup script via child_process
- `getClientIP(req)` - Extracts client IP from request

#### `services/activationLoggerService.js`
- `logActivationRequest(entry)` - Logs activation requests
- `getRecentLogs(limit)` - Retrieves recent logs
- `clearLogs()` - Clears all logs
- `loadActivationLogs()` - Loads existing logs from file

### Controller

#### `controllers/systemController.js`
- `activate(req, res)` - Handles activation requests
- `getActivationLogs(req, res)` - Returns activation logs

### Routes

#### `routes/system.js`
- `POST /system/activate` - Activation endpoint
- `GET /system/activation-logs` - Logs endpoint

### Startup Scripts

#### `scripts/start-runtime.bat` (Windows Batch)
- Sets up environment
- Verifies Node.js and npm
- Installs dependencies if needed
- Starts server with `node server.js`

#### `scripts/start-runtime.ps1` (Windows PowerShell)
- PowerShell version of startup script
- Same functionality as batch script

## Usage Guide

### For Frontend Integration

```javascript
// Example React component
function ActivateSystemButton() {
  const [status, setStatus] = useState('inactive');

  const handleActivate = async () => {
    try {
      setStatus('requesting');
      
      // Send activation request
      const response = await fetch('/system/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.status === 'cancelled') {
        setStatus('User rejected activation');
        return;
      }
      
      if (data.status === 'error') {
        setStatus('Activation error: ' + data.message);
        return;
      }
      
      // Start polling for running status
      setStatus('waiting');
      let attempts = 0;
      const maxAttempts = 60; // ~60 seconds with 1s interval
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const statusRes = await fetch('/system/status');
          const statusData = await statusRes.json();
          
          if (statusData.status === 'running') {
            setStatus('running');
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error('Status poll error:', error);
        }
        
        if (attempts >= maxAttempts) {
          setStatus('Timeout waiting for system');
          clearInterval(pollInterval);
        }
      }, 1000);
      
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  return (
    <button onClick={handleActivate}>
      Activate System ({status})
    </button>
  );
}
```

### For Local User Workflow

1. User clicks "Activate System" in Lovable UI
2. Local computer shows confirmation dialog
3. Local user reviews the message and responds:
   - Click **YES** → System starts automatically
   - Click **NO** → Request is rejected
   - No response for 30 seconds → Defaults to NO
4. Frontend polls status until system is running
5. Once running, complete activation flow

## Monitoring and Debugging

### View Activation Logs
```bash
# Using curl
curl http://localhost:4000/system/activation-logs

# Or in PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/system/activation-logs"
```

### Check System Status
```bash
curl http://localhost:4000/system/status
```

### Manual Log Inspection
The activation logs are stored in JSON format:
```bash
cat logs/activation_log.json
```

### Disable Confirmation (Development Only)
⚠️ **WARNING**: Only do this in development environments!

You can modify `services/activationConfirmationService.js` to skip the dialog:
```javascript
// DEVELOPMENT ONLY - Skip confirmation
function showConfirmationDialog() {
  console.warn('[DEV] Skipping confirmation dialog');
  return Promise.resolve(true); // Always return YES
}
```

## Dependencies

- **node-notifier** (^12.0.0) - Cross-platform system notifications
- **child_process** (built-in) - Execute startup script
- **fs** (built-in) - Log file management

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "node: command not found" | Node.js not installed | Install Node.js from nodejs.org |
| Dialog timeout after 30s | User didn't respond | Click YES/NO within 30 seconds |
| "Failed to execute startup script" | Script file missing | Verify `scripts/start-runtime.bat` exists |
| "Cannot read property 'ip' of undefined" | Request object malformed | Ensure proper HTTP request |

## Performance Considerations

- Dialog display: ~200ms native OS interaction
- Startup script execution: ~2-5 seconds for full system startup
- Polling interval recommended: 1 second
- Maximum polling attempts: 60 (for 60-second timeout)
- Log file max size: Last 1000 entries (~50KB typical)

## Future Enhancements

- [ ] Add webhook notifications on activation events
- [ ] Implement rate limiting for activation requests
- [ ] Add activation PIN/2FA for remote requests
- [ ] Create web dashboard for activation history
- [ ] Add system auto-shutdown timeout
- [ ] Implement activation scheduling
- [ ] Add custom dialogue messages for different scenarios

## Troubleshooting

### Issue: Dialog doesn't appear
**Solution**: Ensure your terminal/IDE has permission to show system notifications.

### Issue: Activation logs empty
**Solution**: Check that `logs/` directory exists and has write permissions.

### Issue: Script runs but server doesn't start
**Solution**: Check for errors in `logs/runtime_errors.log` and verify Node.js server configuration.

### Issue: "Cannot find module 'node-notifier'"
**Solution**: Run `npm install node-notifier` in the project directory.

---

**Version**: 1.0.0  
**Last Updated**: March 16, 2026  
**Maintainer**: ZapFlow Development Team

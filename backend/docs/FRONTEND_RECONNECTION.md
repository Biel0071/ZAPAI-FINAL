# Frontend Reconnection Logic - ZapFlow System Management

## Overview

The Lovable React frontend should implement automatic reconnection logic to handle scenarios where the local runtime or ngrok tunnel goes offline. This ensures users never experience permanent disconnection errors like `ERR_NGROK_3200`.

## Architecture

```
Lovable React Frontend
↓
Automatic Status Polling
↓
Status: running → Use service
Status: offline → Queue requests + Show reconnecting UI
Status: connected again → Flush queue + Resume
```

## API Endpoints for Frontend

### 1. Activation Endpoint
```http
POST /system/activate
```

**Response (Success):**
```json
{
  "status": "starting",
  "message": "System activation confirmed and startup script executed"
}
```

**Response (Cancelled):**
```json
{
  "status": "cancelled",
  "message": "Activation cancelled by user"
}
```

### 2. Runtime Status Endpoint (Most Important)
```http
GET /system/runtime/status
```

**Response:**
```json
{
  "runtime": "running",
  "ngrok": "connected",
  "port": 4000,
  "tunnel": "https://xxxx.ngrok-free.dev",
  "ngrokProcess": "active",
  "lastHealthCheck": "2026-03-16T10:30:00.000Z",
  "lastNgrokRestart": null,
  "ngrokRestartAttempts": 0
}
```

**Status Values:**
- `runtime`: "running" | "offline"
- `ngrok`: "connected" | "disconnected"

### 3. System Status Endpoint
```http
GET /system/status
```

**Response:**
```json
{
  "aiEngine": "healthy",
  "campaignQueue": "stopped",
  "database": "connected",
  "metrics": {...},
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

## Frontend Implementation

### 1. React Hook for Runtime Connection Management

```typescript
// useRuntimeConnection.ts

import { useCallback, useEffect, useRef, useState } from 'react';

interface RuntimeStatus {
  runtime: string;
  ngrok: string;
  port: number;
  tunnel: string | null;
  ngrokProcess: string;
  lastHealthCheck: string | null;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  status: RuntimeStatus | null;
  error: string | null;
  lastError: Error | null;
}

const DEFAULT_POLL_INTERVAL = 3000; // 3 seconds

export function useRuntimeConnection(
  apiBaseUrl = '/system'
) {
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    status: null,
    error: null,
    lastError: null,
  });

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failureCountRef = useRef(0);
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  // Check runtime status
  const checkRuntimeStatus = useCallback(
    async (forceUpdate = false) => {
      try {
        // Cancel previous request if still pending
        if (requestAbortControllerRef.current) {
          requestAbortControllerRef.current.abort();
        }

        requestAbortControllerRef.current = new AbortController();

        const response = await fetch(`${apiBaseUrl}/runtime/status`, {
          signal: requestAbortControllerRef.current.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data: RuntimeStatus = await response.json();

        const isConnected =
          data.runtime === 'running' && data.ngrok === 'connected';

        setState((prev) => ({
          ...prev,
          isConnected,
          status: data,
          error: isConnected ? null : 'ngrok tunnel disconnected',
          lastError: null,
        }));

        failureCountRef.current = 0;

        return isConnected;
      } catch (error: any) {
        const isAborted = error?.name === 'AbortError';

        if (!isAborted) {
          failureCountRef.current++;

          const err = error as Error;
          setState((prev) => ({
            ...prev,
            isConnected: false,
            error: `Connection check failed (attempt ${failureCountRef.current})`,
            lastError: err,
          }));

          console.error('[RuntimeConnection] Status check failed:', err);
        }

        return false;
      }
    },
    [apiBaseUrl]
  );

  // Request runtime activation
  const requestActivation = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isConnecting: true }));

      const response = await fetch(`${apiBaseUrl}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.status === 'cancelled') {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: 'Activation cancelled',
        }));
        return false;
      }

      if (data.status === 'error') {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: data.message || 'Activation failed',
        }));
        return false;
      }

      // Status is 'starting' - poll until ready
      return true;
    } catch (error) {
      const err = error as Error;
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to request activation',
        lastError: err,
      }));
      return false;
    }
  }, [apiBaseUrl]);

  // Poll for runtime status
  const startPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    const poll = async () => {
      await checkRuntimeStatus();

      // Continue polling
      pollTimeoutRef.current = setTimeout(poll, DEFAULT_POLL_INTERVAL);
    };

    // Initial check
    poll();
  }, [checkRuntimeStatus]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    if (requestAbortControllerRef.current) {
      requestAbortControllerRef.current.abort();
    }
  }, []);

  // Auto-start polling on mount
  useEffect(() => {
    startPolling();

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  return {
    ...state,
    checkRuntimeStatus,
    requestActivation,
    startPolling,
    stopPolling,
  };
}
```

### 2. Reconnection Component Example

```typescript
// RuntimeReconnectionOverlay.tsx

import React from 'react';
import { useRuntimeConnection } from './useRuntimeConnection';

interface ReconnectionOverlayProps {
  visible: boolean;
  onClose?: () => void;
}

export function RuntimeReconnectionOverlay({
  visible,
  onClose,
}: ReconnectionOverlayProps) {
  const runtime = useRuntimeConnection();

  if (!visible || runtime.isConnected) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {runtime.isConnecting ? 'Activating System...' : 'Runtime Offline'}
        </h2>

        <p className="text-gray-600 mb-4">
          {runtime.isConnecting
            ? 'Please wait while the local runtime starts up...'
            : `The local ZapFlow runtime is offline. Current status: ${runtime.status?.ngrok || 'unknown'}`}
        </p>

        {runtime.error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {runtime.error}
          </div>
        )}

        <div className="flex gap-3">
          {!runtime.isConnecting && (
            <>
              <button
                onClick={async () => {
                  await runtime.requestActivation();
                }}
                disabled={runtime.isConnecting}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Activate System
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                >
                  Dismiss
                </button>
              )}
            </>
          )}

          {runtime.isConnecting && (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin border-4 border-gray-300 border-t-blue-600 rounded-full w-6 h-6" />
            </div>
          )}
        </div>

        {runtime.status && (
          <div className="mt-4 text-xs text-gray-500 bg-gray-100 p-2 rounded">
            <p>Runtime: {runtime.status.runtime}</p>
            <p>ngrok: {runtime.status.ngrok}</p>
            {runtime.status.tunnel && (
              <p>Tunnel: {runtime.status.tunnel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3. Request Queue Implementation

```typescript
// useRequestQueue.ts

import { useCallback, useRef } from 'react';

interface QueuedRequest {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export function useRequestQueue() {
  const queueRef = useRef<QueuedRequest[]>([]);
  const processingRef = useRef(false);

  const enqueue = useCallback(
    (fn: () => Promise<any>): Promise<any> => {
      return new Promise((resolve, reject) => {
        queueRef.current.push({
          id: Date.now().toString(),
          fn,
          resolve,
          reject,
        });
      });
    },
    []
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const request = queueRef.current.shift();

      if (!request) break;

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    processingRef.current = false;
  }, []);

  const clear = useCallback(() => {
    queueRef.current.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
    queueRef.current = [];
  }, []);

  return {
    enqueue,
    processQueue,
    queueSize: () => queueRef.current.length,
    clear,
  };
}
```

### 4. Main App Integration Example

```typescript
// App.tsx (Lovable Component)

import React, { useEffect, useState } from 'react';
import { useRuntimeConnection } from './hooks/useRuntimeConnection';
import { useRequestQueue } from './hooks/useRequestQueue';
import { RuntimeReconnectionOverlay } from './components/RuntimeReconnectionOverlay';

export function App() {
  const runtime = useRuntimeConnection();
  const requestQueue = useRequestQueue();
  const [showReconnection, setShowReconnection] = useState(false);

  // Monitor connection state
  useEffect(() => {
    if (!runtime.isConnected && !runtime.isConnecting) {
      setShowReconnection(true);
    } else if (runtime.isConnected) {
      setShowReconnection(false);
      // Process any queued requests
      requestQueue.processQueue();
    }
  }, [runtime.isConnected, runtime.isConnecting, requestQueue]);

  // Wrapper for API calls that should queue during disconnection
  const safeApiCall = React.useCallback(
    async (fn: () => Promise<any>) => {
      if (!runtime.isConnected) {
        // Queue the request
        return requestQueue.enqueue(fn);
      }

      // Execute immediately
      return fn();
    },
    [runtime.isConnected, requestQueue]
  );

  return (
    <div className="app">
      <RuntimeReconnectionOverlay
        visible={showReconnection}
        onClose={() => setShowReconnection(false)}
      />

      {/* Rest of app */}
      <YourMainComponent safeApiCall={safeApiCall} />
    </div>
  );
}
```

## Polling Strategy

### Recommended Configuration
- **Poll Interval:** 3 seconds
- **Initial Status Check:** Immediate
- **Backoff:** No exponential backoff (constant polling is better for this use case)
- **Timeout:** 5 seconds per request
- **Max Failures:** No limit (keep trying)

### Why Every 3 Seconds?
- Detects reconnection quickly (< 6 seconds typically)
- Low overhead on server
- Balances UX and resource usage
- Aligned with ngrok health check interval

## Reconnection Flow

```
1. Frontend starts polling /system/runtime/status
   ↓
2. receives: {"runtime": "running", "ngrok": "connected"}
   ↓
3. User loses connection (ngrok crashes or network issue)
   ↓
4. Next poll fails or returns: {"runtime": "running", "ngrok": "disconnected"}
   ↓
5. Frontend shows "Runtime Offline" overlay
   ↓
6. Queue any pending requests
   ↓
7. Local runtime's RuntimeManager detects failure and restarts ngrok
   ↓
8. Frontend's next poll succeeds: {"runtime": "running", "ngrok": "connected"}
   ↓
9. Frontend hides overlay and processes queued requests
```

## Error Handling

### Network Errors
- **No Response:** Show "Connecting..." state
- **Timeout:** Retry after 3 seconds
- **CORS Error:** Check frontend origin in backend

### Runtime Errors
- **400 Bad Request:** Check API format
- **500 Server Error:** Log and keep retrying
- **404 Not Found:** Check endpoint path

### ngrok-Specific Errors
- **ERR_NGROK_3200:** Handled by RuntimeManager auto-restart
- **Tunnel Connection Lost:** RuntimeManager will detect and restart
- **Auth Token Expired:** User needs to update NGROK_AUTH_TOKEN

## Best Practices

### 1. Always Implement Polling
```javascript
// Good
useEffect(() => {
  const interval = setInterval(checkStatus, 3000);
  return () => clearInterval(interval);
}, []);

// Avoid relying only on events
```

### 2. Queue Requests During Downtime
```javascript
// Good
if (!isConnected) {
  requestQueue.add(request);
} else {
  executeRequest();
}

// Avoid
if (!isConnected) {
  showError('Offline'); // User loses unsent messages
}
```

### 3. Show User Feedback
```javascript
// Good - User knows what's happening
<div>
  Status: {isConnected ? '✅ Connected' : '⏳ Reconnecting...'}
  Tunnel: {tunnel || 'Loading...'}
</div>

// Avoid - Silent failure
```

### 4. Handle Long Startup Times
```javascript
// Good - Generous timeout
const maxAttempts = 120; // 10 minutes of polling

// Avoid - Giving up too soon
const maxAttempts = 5; // 15 seconds (too short)
```

## Testing Reconnection Logic

### Test Scenarios

1. **ngrok Crash**
   - Kill ngrok process manually
   - Observe frontend shows reconnecting
   - Observe RuntimeManager restarts it
   - Observe frontend reconnects

2. **Network Interruption**
   - Disconnect network
   - Observe queue accumulates requests
   - Reconnect network
   - Observe requests process

3. **Full Runtime Restart**
   - Stop Node.js server entirely
   - Observe frontend waits
   - Start server via activation dialog
   - Observe frontend reconnects

### Debug Commands

```bash
# Check runtime status
curl http://localhost:4000/system/runtime/status

# Check runtime debug info
curl http://localhost:4000/system/runtime/debug

# Get runtime logs
curl http://localhost:4000/system/runtime/logs

# Manually restart ngrok
curl -X POST http://localhost:4000/system/runtime/restart-ngrok
```

## Performance Considerations

| Metric | Value | Impact |
|--------|-------|--------|
| Poll Interval | 3s | Reconnection time < 6s |
| Timeout per Poll | 5s | Prevents UI blocking |
| Queue Size | Unlimited | High memory if offline long |
| Log File Size | 10 MB | Auto-rotates |

## Environment Variables

```bash
# Optional ngrok configuration
NGROK_AUTH_TOKEN=your_token_here
NGROK_PORT=4000

# Auto-managed by RuntimeManager
NGROK_MANAGED_EXTERNALLY=false
```

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| "CORS blocked for origin" | Add Lovable domain to CORS whitelist in server.js |
| "Poll never succeeds" | Check ngrok is installed: `where ngrok` |
| "Tunnel URL keeps changing" | Normal - ngrok assigns new URL on restart |
| "Memory leak from queued requests" | Implement queue size limit (e.g., 100 max) |
| "Poll times out but connection works" | Increase timeout from 5s to 10s |

---

**Version**: 1.0.0  
**Last Updated**: March 16, 2026  
**Framework**: React (Lovable)  
**Backend**: Node.js with RuntimeManager

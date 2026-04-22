const { spawn } = require('child_process');
const path = require('path');

/**
 * Shows a PowerShell confirmation prompt for ZapFlow activation
 * Prompts the local computer user with Y/N confirmation
 * @returns {Promise<boolean>} - true if user confirmed (Y), false if declined (N) or timeout
 */
function showConfirmationDialog() {
  return new Promise((resolve) => {
    try {
      console.log('[Activation] Showing PowerShell confirmation prompt...');

      const psCommand = `
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  ZapFlow Activation Request" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "A remote request to activate the ZapFlow runtime has been received." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Do you want to start the system now? (Y/N)" -ForegroundColor Yellow
        Write-Host ""
        $response = Read-Host "Enter your choice"
        
        if ($response -eq 'Y' -or $response -eq 'y' -or $response -eq 'Yes' -or $response -eq 'yes') {
          exit 0
        } else {
          exit 1
        }
      `;

      // Timeout after 30 seconds - defaults to NO
      const timeout = setTimeout(() => {
        console.log('[Activation] Confirmation prompt timeout - defaulting to NO');
        psProcess.kill();
        resolve(false);
      }, 30000);

      const psProcess = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false,
      });

      psProcess.on('exit', (code, signal) => {
        clearTimeout(timeout);

        if (signal === 'SIGTERM') {
          // Timeout occurred
          console.log('[Activation] Confirmation prompt killed by timeout');
          resolve(false);
          return;
        }

        const confirmed = code === 0;
        console.log('[Activation] User response:', confirmed ? 'YES (Y)' : 'NO (N)');
        resolve(confirmed);
      });

      psProcess.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Activation] PowerShell process error:', err);
        resolve(false);
      });
    } catch (error) {
      console.error('[Activation] Error showing confirmation prompt:', error);
      resolve(false);
    }
  });
}

/**
 * Starts the runtime processes:
 * 1. Node.js server
 * 2. ngrok tunnel
 * 3. Initializes Baileys sessions
 * @returns {Promise<boolean>} - true if startup sequence initiated successfully
 */
async function startRuntimeProcesses() {
  return new Promise((resolve) => {
    try {
      console.log('[Startup] Starting runtime processes...');

      const workDir = path.join(__dirname, '..');

      // Start Node.js server
      console.log('[Startup] Launching Node.js server...');
      const nodeProcess = spawn('node', ['server.js'], {
        cwd: workDir,
        detached: true,
        stdio: 'ignore',
      });

      nodeProcess.unref();

      console.log('[Startup] Node.js server launched (PID:', nodeProcess.pid, ')');

      // Wait 3 seconds for server to start before launching ngrok
      setTimeout(() => {
        console.log('[Startup] Launching ngrok tunnel...');

        const ngrokProcess = spawn('ngrok', ['http', '4000'], {
          detached: true,
          stdio: 'ignore',
        });

        ngrokProcess.unref();

        console.log('[Startup] ngrok tunnel launched (PID:', ngrokProcess.pid, ')');
        console.log('[Startup] Runtime processes started successfully');

        resolve(true);
      }, 3000);

      // Timeout after 15 seconds
      const startupTimeout = setTimeout(() => {
        resolve(true); // Consider startup successful after 15s
      }, 15000);

      nodeProcess.on('error', (err) => {
        clearTimeout(startupTimeout);
        console.error('[Startup] Node process error:', err);
        resolve(false);
      });
    } catch (error) {
      console.error('[Startup] Failed to start runtime processes:', error);
      resolve(false);
    }
  });
}

/**
 * Executes the startup script (legacy - kept for backward compatibility)
 * @returns {Promise<boolean>} - true if startup script executed successfully
 */
async function executeStartupScript() {
  return new Promise((resolve) => {
    try {
      console.log('[Startup] Executing startup script...');

      const startupScript = path.join(__dirname, '..', 'scripts', 'start-runtime.bat');

      const child = spawn('cmd.exe', ['/c', startupScript], {
        detached: false,
        stdio: 'inherit',
      });

      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          resolve(true); // Consider success after timeout
        }
      }, 30000);

      child.on('error', (err) => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          console.error('[Startup] Script execution error:', err);
          resolve(false);
        }
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          if (code === 0) {
            console.log('[Startup] Script completed successfully');
            resolve(true);
          } else {
            console.error('[Startup] Script failed with exit code:', code);
            resolve(false);
          }
        }
      });
    } catch (error) {
      console.error('[Startup] Failed to execute startup script:', error);
      resolve(false);
    }
  });
}

/**
 * Gets the client IP address from the request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = {
  showConfirmationDialog,
  startRuntimeProcesses,
  executeStartupScript,
  getClientIP,
};

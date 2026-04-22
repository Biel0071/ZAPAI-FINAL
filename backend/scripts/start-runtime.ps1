# ZapFlow Runtime Startup Script for Windows (PowerShell)
# This script:
# - Starts the Node.js server
# - Runtime manager automatically:
#   * Starts ngrok tunnel
#   * Monitors health
#   * Auto-restarts on failure
# - Initializes Baileys sessions
# - Enables business hours and AI features

Write-Host ""
Write-Host "======================================"
Write-Host "  ZapFlow - Baileys Server Startup"
Write-Host "======================================"
Write-Host ""

# Get the directory where this script is located
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$WORK_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "[Startup] Working directory: $WORK_DIR"
Write-Host "[Startup] Script directory: $SCRIPT_DIR"
Write-Host ""

# Set location to working directory
Set-Location $WORK_DIR

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[Startup] Node.js found: $nodeVersion"
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH"
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "[Startup] npm found: $npmVersion"
} catch {
    Write-Host "[ERROR] npm is not installed or not in PATH"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if ngrok is installed
try {
    $ngrokVersion = ngrok --version
    Write-Host "[Startup] ngrok found: $ngrokVersion"
} catch {
    Write-Host "[WARNING] ngrok is not installed or not in PATH"
    Write-Host "ngrok is required for remote tunnel access"
    Write-Host "Download from: https://ngrok.com/download"
    Write-Host ""
}

# Check if node_modules exist, if not install dependencies
if (-Not (Test-Path "$WORK_DIR\node_modules")) {
    Write-Host "[Startup] Installing dependencies..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[Startup] Dependencies installed successfully"
    Write-Host ""
}

# Check ngrok auth token
if ($env:NGROK_AUTH_TOKEN) {
    Write-Host "[Startup] ngrok auth token is set"
} else {
    try {
        $ngrokTest = ngrok --version 2>$null
        Write-Host "[WARNING] NGROK_AUTH_TOKEN environment variable is not set"
        Write-Host "Your ngrok tunnel may be limited to 2 hours per session"
        Write-Host "Set NGROK_AUTH_TOKEN to use your ngrok account for unlimited sessions"
        Write-Host ""
    } catch {
        # ngrok not fully installed, already warned above
    }
}

Write-Host "[Startup] Starting ZapFlow runtime..."
Write-Host "[Startup] Launching: node server.js"
Write-Host "[Startup] Runtime Manager will automatically handle ngrok tunnel and monitoring"
Write-Host ""

# Set environment variables for startup
$runtimePort = if ($env:PORT) { $env:PORT } else { '4000' }
$env:PORT = $runtimePort
$env:NODE_ENV = "production"
$env:NGROK_MANAGED_EXTERNALLY = "false"
$env:NGROK_PORT = $runtimePort

Write-Host "[Startup] Runtime PORT: $($env:PORT)"
Write-Host "[Startup] ngrok target PORT: $($env:NGROK_PORT)"
Write-Host ""

# Start the server - this will keep running
# Press Ctrl+C to stop
& node server.js

# If the script reaches here, the server has stopped
Write-Host ""
Write-Host "[Startup] ZapFlow server has stopped"
Write-Host ""
Write-Host "Check logs/runtime.log for detailed information"
Write-Host ""
Read-Host "Press Enter to exit"
exit 0

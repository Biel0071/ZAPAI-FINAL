param(
  [string]$Port = $(if ($env:PORT) { $env:PORT } else { '4000' }),
  [string]$NodeEnv = $(if ($env:NODE_ENV) { $env:NODE_ENV } else { 'production' }),
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$SkipInstall,
  [switch]$ActivateSystem,
  [switch]$StartNgrok,
  [switch]$ValidateRemote
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $projectRoot 'logs'
$stdoutLog = Join-Path $logsDir 'runtime_stdout.log'
$stderrLog = Join-Path $logsDir 'runtime_stderr.log'
$ngrokLog = Join-Path $logsDir 'ngrok_stdout.log'

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Escape-SingleQuoted([string]$Value) {
  if ($null -eq $Value) {
    return ''
  }

  return $Value -replace "'", "''"
}

function Wait-HttpEndpoint([string]$Uri, [int]$TimeoutSeconds = 60, [hashtable]$Headers = $null) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      if ($Headers) {
        return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 5 -Headers $Headers
      }

      return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 5
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Timeout aguardando endpoint: $Uri"
}

function Wait-NgrokUrl([int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
      $httpsTunnel = @($response.tunnels) | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1

      if ($httpsTunnel -and $httpsTunnel.public_url) {
        return $httpsTunnel.public_url.TrimEnd('/')
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw 'Timeout aguardando a URL publica do ngrok.'
}

function Invoke-JsonPost([string]$Uri, [hashtable]$Body) {
  return Invoke-RestMethod -Method Post -Uri $Uri -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 5)
}

Set-Location $projectRoot

if (-not (Test-Path $logsDir)) {
  New-Item -Path $logsDir -ItemType Directory | Out-Null
}

Write-Step 'Pre-check'
node -v
npm -v

$env:NODE_ENV = $NodeEnv
$env:PORT = $Port
$env:NGROK_MANAGED_EXTERNALLY = 'true'

if ($DatabaseUrl) {
  $env:DATABASE_URL = $DatabaseUrl
  Write-Host 'DATABASE_URL configurada para o processo atual.'
} else {
  Write-Warning 'DATABASE_URL nao informada. O runtime ainda pode subir, mas o inbox ficara em modo degradado.'
}

if (-not $SkipInstall) {
  Write-Step 'Instalando dependencias'
  if (Test-Path (Join-Path $projectRoot 'package-lock.json')) {
    npm ci
  } else {
    npm install
  }
}

$ngrokUrl = $null
$ngrokProcess = $null

if ($StartNgrok) {
  Write-Step 'Subindo ngrok externo'
  $null = Get-Command ngrok -ErrorAction Stop

  if (Test-Path $ngrokLog) {
    Remove-Item $ngrokLog -Force
  }

  $ngrokProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoLogo',
    '-NoExit',
    '-Command',
    "ngrok http $Port"
  ) -PassThru -RedirectStandardOutput $ngrokLog -RedirectStandardError $ngrokLog

  $ngrokUrl = Wait-NgrokUrl
  Write-Host "Ngrok publico: $ngrokUrl"
}

Write-Step 'Subindo runtime'

if (Test-Path $stdoutLog) {
  Remove-Item $stdoutLog -Force
}

if (Test-Path $stderrLog) {
  Remove-Item $stderrLog -Force
}

$escapedProjectRoot = Escape-SingleQuoted $projectRoot
$escapedNodeEnv = Escape-SingleQuoted $NodeEnv
$escapedPort = Escape-SingleQuoted $Port
$escapedDatabaseUrl = Escape-SingleQuoted $DatabaseUrl

$runtimeCommand = @(
  "Set-Location '$escapedProjectRoot'",
  "`$env:NODE_ENV = '$escapedNodeEnv'",
  "`$env:PORT = '$escapedPort'",
  "`$env:NGROK_MANAGED_EXTERNALLY = 'true'"
)

if ($DatabaseUrl) {
  $runtimeCommand += "`$env:DATABASE_URL = '$escapedDatabaseUrl'"
}

$runtimeCommand += 'npm start'

$serverProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
  '-NoLogo',
  '-NoExit',
  '-Command',
  ($runtimeCommand -join '; ')
) -WorkingDirectory $projectRoot -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

$baseUrl = "http://127.0.0.1:$Port"

Write-Step 'Aguardando runtime responder'
$health = Wait-HttpEndpoint -Uri "$baseUrl/health"
Write-Host ("Health: " + ($health | ConvertTo-Json -Compress))

Write-Step 'Validando endpoints locais'
$systemStatus = Wait-HttpEndpoint -Uri "$baseUrl/system/status"
$publicUrl = Wait-HttpEndpoint -Uri "$baseUrl/public-url"
$sessions = Wait-HttpEndpoint -Uri "$baseUrl/sessions"

Write-Host ("system/status: " + ($systemStatus | ConvertTo-Json -Compress))
Write-Host ("public-url: " + ($publicUrl | ConvertTo-Json -Compress))
Write-Host ("sessions: " + ($sessions | ConvertTo-Json -Compress))

if ($ActivateSystem) {
  Write-Step 'Ativando sistema'
  $activation = Invoke-JsonPost -Uri "$baseUrl/system/start" -Body @{}
  Write-Host ("system/start: " + ($activation | ConvertTo-Json -Compress))
}

if ($ValidateRemote) {
  if (-not $ngrokUrl) {
    throw 'Use -StartNgrok junto com -ValidateRemote para validar endpoints externos.'
  }

  Write-Step 'Validando endpoints externos'
  $ngrokHeaders = @{ 'ngrok-skip-browser-warning' = 'true' }
  $remoteSystemStatus = Wait-HttpEndpoint -Uri "$ngrokUrl/system/status" -Headers $ngrokHeaders
  $remotePublicUrl = Wait-HttpEndpoint -Uri "$ngrokUrl/public-url" -Headers $ngrokHeaders
  $remoteSessions = Wait-HttpEndpoint -Uri "$ngrokUrl/sessions" -Headers $ngrokHeaders

  Write-Host ("remote system/status: " + ($remoteSystemStatus | ConvertTo-Json -Compress))
  Write-Host ("remote public-url: " + ($remotePublicUrl | ConvertTo-Json -Compress))
  Write-Host ("remote sessions: " + ($remoteSessions | ConvertTo-Json -Compress))
}

Write-Host ''
Write-Host "Runtime PID: $($serverProcess.Id)"

if ($ngrokProcess) {
  Write-Host "Ngrok PID: $($ngrokProcess.Id)"
}

Write-Host 'Logs:'
Write-Host "  STDOUT: $stdoutLog"
Write-Host "  STDERR: $stderrLog"

if ($ngrokProcess) {
  Write-Host "  NGROK:  $ngrokLog"
}

if ($ngrokUrl) {
  Write-Host ''
  Write-Host "Atualize TARGET_API_URL com: $ngrokUrl"
}

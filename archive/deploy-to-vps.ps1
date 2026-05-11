# deploy-to-vps.ps1 — Deploy automatizado da máquina local Windows para VPS Ubuntu
# Requer: OpenSSH Client (Windows 10/11 nativo), git
# Uso: .\deploy-to-vps.ps1 [-VpsIp 209.50.229.68] [-User root]

param(
    [string]$VpsIp = "209.50.229.68",
    [string]$User = "root",
    [string]$ProjectDir = "/opt/zapai",
    [switch]$SkipGitPush,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Ok($msg)  { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Info($msg){ Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg){ Write-Host "[WARN]  $msg" -ForegroundColor Yellow }

# ── 1. Validar ambiente local ─────────────────────────────────
Write-Info "=== Validando ambiente local ==="

if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git nao encontrado. Instale o Git para Windows."
}

# Detectar se ha mudancas pendentes
$status = git status --short
if ($status) {
    Write-Warn "Ha mudancas nao commitadas. Commitando automaticamente..."
    git add -A
    git commit -m "auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
}

# Push para origin (se houver)
$remotes = git remote
if ($remotes -contains "origin") {
    if (!$SkipGitPush) {
        Write-Info "Enviando codigo para origin..."
        git push origin $(git branch --show-current) 2>$null
        Write-Ok "Codigo enviado"
    }
} else {
    Write-Warn "Nenhum remote 'origin' configurado. Deploy sera feito via SCP/RSYNC."
}

# ── 2. Conectar via SSH e executar deploy ─────────────────────
Write-Info "=== Conectando a VPS ${VpsIp} via SSH ==="

# Verificar conectividade
if (!(Test-Connection -TargetName $VpsIp -Count 1 -Quiet)) {
    throw "VPS ${VpsIp} inacessivel. Verifique a rede/conexao."
}

$sshCmd = "ssh ${User}@${VpsIp}"

# Verificar se diretorio existe na VPS
$checkDir = Invoke-Expression "$sshCmd 'test -d ${ProjectDir} && echo EXISTS || echo MISSING'" 2>$null
if ($checkDir -match "MISSING") {
    Write-Info "Criando diretorio do projeto na VPS..."
    Invoke-Expression "$sshCmd 'mkdir -p ${ProjectDir}'" | Out-Null
}

# Rsync / scp do projeto (ignorar node_modules, .git, etc.)
Write-Info "Sincronizando arquivos para VPS..."
$localRoot = git rev-parse --show-toplevel

# Usar rsync se disponivel, senao scp
if (Get-Command rsync -ErrorAction SilentlyContinue) {
    $rsyncArgs = @(
        "-avz", "--delete",
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=frontend/node_modules",
        "--exclude=backend/node_modules",
        "--exclude=frontend/dist",
        "--exclude=*.log",
        "$localRoot/",
        "${User}@${VpsIp}:${ProjectDir}/"
    )
    & rsync @rsyncArgs
} else {
    # Fallback: git archive + scp
    $archive = Join-Path $env:TEMP "zapai-deploy.tar.gz"
    git archive --format=tar.gz -o $archive HEAD
    scp $archive "${User}@${VpsIp}:/tmp/zapai-deploy.tar.gz" | Out-Null
    Invoke-Expression "$sshCmd 'cd ${ProjectDir} && tar xzf /tmp/zapai-deploy.tar.gz --overwrite && rm /tmp/zapai-deploy.tar.gz'" | Out-Null
    Remove-Item $archive -ErrorAction SilentlyContinue
}

Write-Ok "Arquivos sincronizados"

# ── 3. Executar auto-deploy na VPS ────────────────────────────
Write-Info "=== Executando auto-deploy na VPS ==="

$deployCmd = "cd ${ProjectDir} && chmod +x infra/scripts/auto-deploy.sh && bash infra/scripts/auto-deploy.sh"
Invoke-Expression "$sshCmd '$deployCmd'"

if ($LASTEXITCODE -ne 0) {
    Write-Warn "auto-deploy retornou codigo $LASTEXITCODE"
}

Write-Ok "Deploy finalizado!"
Write-Info "Acesse: http://${VpsIp} (ou https se dominio configurado)"

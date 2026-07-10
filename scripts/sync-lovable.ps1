# Sync Lovable changes to local workspace and deploy to VPS
Write-Host "1. Buscando atualizações do Lovable..." -ForegroundColor Cyan
git fetch lovable-source

Write-Host "2. Mesclando atualizações na branch local..." -ForegroundColor Cyan
git checkout main
git merge lovable-source/main --no-edit

Write-Host "3. Validando tipos do frontend..." -ForegroundColor Cyan
$env:PATH="c:\projetos\ZAPAI-FINAL;$env:PATH"
Set-Location -Path "frontend-official"
npx tsc --noEmit
$TscExitCode = $LASTEXITCODE
Set-Location -Path ".."

if ($TscExitCode -ne 0) {
    Write-Error "Erro de compilação detectado nas alterações do Lovable! Corrija os erros antes de enviar para a VPS."
    exit 1
}

Write-Host "4. Compilação bem sucedida! Enviando para a VPS..." -ForegroundColor Green
git push origin main
Write-Host "Sincronização concluída! A VPS estará atualizada em 60 segundos." -ForegroundColor Green

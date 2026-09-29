@echo off

echo ========= BACKEND =========
curl http://localhost:4025/health

echo.
echo ========= PORTAS =========
netstat -ano | findstr :4025
netstat -ano | findstr :8080

pause

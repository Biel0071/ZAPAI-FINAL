#!/bin/bash
# ZAPAI VPS Inspection Script

echo "========================================="
echo "        ZAPAI VPS INSPECTOR"
echo "========================================="

echo -e "\n--- Running Nginx/OpenResty Processes (Conf Path) ---"
ps aux | grep -E "nginx|openresty" | grep -v grep || echo "Nenhum processo Nginx/OpenResty rodando."

echo -e "\n--- Docker Containers ---"
docker ps 2>/dev/null || echo "Docker não instalado ou inativo."

echo -e "\n--- System Services (Nginx/OpenResty/Panel) ---"
systemctl list-units --type=service | grep -E "nginx|openresty|panel|integrator|icp" 2>/dev/null || echo "Nenhum serviço correspondente encontrado."

echo -e "\n--- OpenResty Binary Path ---"
which openresty nginx 2>/dev/null || echo "Binários não encontrados no PATH"

echo -e "\n--- Curl Port 80 (HTTP) locally ---"
curl -Iv http://127.0.0.1/

echo -e "\n--- Curl Port 443 (HTTPS) locally ---"
curl -Iv -k https://127.0.0.1/

echo -e "\n--- Curl Backend (Port 4025) locally ---"
curl -Iv http://127.0.0.1:4025/health


#!/bin/bash
# ZAPAI VPS Inspection Script

echo "========================================="
echo "        ZAPAI VPS INSPECTOR"
echo "========================================="

echo -e "\n--- Nginx Service Status ---"
systemctl status nginx --no-pager 2>/dev/null || service nginx status

echo -e "\n--- Curl Port 80 (HTTP) locally ---"
curl -Iv http://127.0.0.1/

echo -e "\n--- Curl Port 443 (HTTPS) locally ---"
curl -Iv -k https://127.0.0.1/

echo -e "\n--- Curl Backend (Port 4025) locally ---"
curl -Iv http://127.0.0.1:4025/health

echo -e "\n--- Nginx Virtual Hosts ---"
nginx -T 2>/dev/null | grep -E "server_name|listen|return 30" || echo "Não foi possível rodar nginx -T"

echo -e "\n--- aaPanel vhost files ---"
ls -la /www/server/panel/vhost/nginx/ 2>/dev/null || echo "aaPanel vhost folder not found"

echo -e "\n--- Active sites-enabled ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "sites-enabled not found"

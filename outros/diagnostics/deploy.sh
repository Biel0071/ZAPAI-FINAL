#!/bin/bash
echo "Entering /opt/zapai"
cd /opt/zapai
echo "Pulling latest changes..."
git pull origin main
echo "Entering backend..."
cd backend
echo "Installing dependencies..."
npm install
echo "Restarting PM2 processes..."
pm2 restart all
echo "Deployment completed successfully!"

// PM2 ecosystem — ZapAI backend
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 reload ecosystem.config.js --env production --update-env
//   pm2 save && pm2 startup
//
// APP_DIR env var overrides /opt/zapai (set by install.sh automatically).
const path = require('path');
const APP_DIR = process.env.APP_DIR || '/opt/zapai';

module.exports = {
  apps: [
    {
      name: 'zapai-backend',
      script: 'server.js',
      cwd: path.join(APP_DIR, 'backend'),
      instances: 1,                   // WhatsApp session state is single-process
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
      max_memory_restart: '800M',

      env_production: {
        NODE_ENV: 'production',
        PORT: 4025,
        USE_NGROK: 'false',
        NGROK_MANAGED_EXTERNALLY: 'true',
        CRASH_EXIT_ON_UNHANDLED: 'true',
        LOG_LEVEL: 'info',
        LOG_CONSOLE_QUIET: 'false',
      },

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(APP_DIR, 'logs/app.log'),
      error_file: path.join(APP_DIR, 'logs/error.log'),
      merge_logs: true,
    },
    {
      name: 'zapai-frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --host 0.0.0.0 --port 3000',
      cwd: path.join(APP_DIR, 'frontend'),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '400M',

      env_production: {
        NODE_ENV: 'production',
      },

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(APP_DIR, 'logs/frontend.log'),
      error_file: path.join(APP_DIR, 'logs/frontend-error.log'),
      merge_logs: true,
    },
  ],
};

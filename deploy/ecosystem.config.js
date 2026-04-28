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
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '800M',
      node_args: '--max-old-space-size=768',

      env_production: {
        NODE_ENV: 'production',
        NODE_ROLE: 'master',
        MASTER: 'true',
        PORT: 4025,
        HOST: '0.0.0.0',
        MASTER_API_URL: 'http://209.50.229.68:4025',
        CRASH_EXIT_ON_UNHANDLED: 'true',
        LOG_LEVEL: 'info',
        LOG_CONSOLE_QUIET: 'false',
      },

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: path.join(APP_DIR, 'logs/app.log'),
      error_file: path.join(APP_DIR, 'logs/error.log'),
      merge_logs: true,
      log_type: 'json',
      time: true,
    },
  ],
};

// PM2 ecosystem — ZapAI backend
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 reload ecosystem.config.js --env production --update-env
//   pm2 save && pm2 startup
//
// APP_DIR env var overrides /opt/ZAPAI-FINAL.
const path = require('path');
const APP_DIR = process.env.APP_DIR || '/opt/ZAPAI-FINAL';
const PM2_INSTANCES = process.env.PM2_INSTANCES || '1';
const PM2_EXEC_MODE = Number(PM2_INSTANCES) > 1 ? 'cluster' : 'fork';

module.exports = {
  apps: [
    {
      name: 'zapai-backend',
      script: 'server.js',
      cwd: path.join(APP_DIR, 'backend'),
      instances: PM2_INSTANCES,
      exec_mode: PM2_EXEC_MODE,
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
        LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
        LOG_CONSOLE_QUIET: 'false',
        PM2_GRACEFUL_LISTEN_TIMEOUT: '8000',
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

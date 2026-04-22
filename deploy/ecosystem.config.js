// PM2 ecosystem — ZapAI backend
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js --update-env
//   pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'zapai-backend',
      script: 'server.js',
      cwd: '/opt/zapai/backend',
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
        NGROK_MANAGED_EXTERNALLY: 'true',
        CRASH_EXIT_ON_UNHANDLED: 'true',
        LOG_LEVEL: 'info',
        LOG_CONSOLE_QUIET: 'false',
      },

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/opt/zapai/logs/app.log',
      error_file: '/opt/zapai/logs/error.log',
      merge_logs: true,
    },
  ],
};

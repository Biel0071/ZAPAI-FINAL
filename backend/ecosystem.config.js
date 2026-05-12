/**
 * PM2 Ecosystem Configuration — ZAPFLOW AI Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --update-env
 *   pm2 logs zapflow-api
 *
 * Features:
 * - Cluster mode for multi-core utilization
 * - Graceful shutdown (SIGINT → 8s window)
 * - Auto-restart with exponential backoff
 * - Memory-based restart (900MB threshold)
 * - Structured log files
 * - Environment separation
 */

module.exports = {
  apps: [
    {
      name: 'zapflow-api',
      script: './server.js',
      cwd: __dirname,

      // ─── Cluster ───
      instances: 1,  // Set to 'max' for multi-core; 1 for Baileys (stateful sockets)
      exec_mode: 'fork', // Use 'fork' — Baileys holds session state in-process

      // ─── Restart Policy ───
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '900M',

      // ─── Graceful Shutdown ───
      kill_timeout: 8000,
      listen_timeout: 10000,
      shutdown_with_message: false,

      // ─── Logs ───
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // ─── Node Options ───
      node_args: [
        '--max-old-space-size=1024',
        '--expose-gc',
      ].join(' '),

      // ─── Environment Variables ───
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};

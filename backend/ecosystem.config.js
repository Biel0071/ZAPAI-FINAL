/**
 * PM2 Ecosystem Configuration — ZAPFLOW AI Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --update-env
 *   pm2 logs zapflow-api
 *   pm2 save
 *   pm2 startup
 *
 * Key design decisions:
 * - fork mode (NOT cluster): Baileys holds in-process socket state; cluster
 *   mode would fork the Baileys runtime and break session sharing.
 * - max_memory_restart 900M: VPS with 2GB RAM — triggers clean PM2 restart
 *   before OOM kill, giving the process time to flush auth to disk.
 * - WHATSAPP_MAX_RECONNECT_REQUESTS=50: in production a single telecom
 *   blip should not permanently halt the session after 5 tries.
 * - GRACEFUL_SHUTDOWN_TIMEOUT_MS=12000: gives Baileys time to write
 *   auth state (creds.json) before process exits.
 */

module.exports = {
  apps: [
    {
      name: 'zapflow-api',
      script: './server.js',
      cwd: __dirname,

      // ─── Process Mode ───
      instances: 1,       // Baileys is stateful — must be single instance
      exec_mode: 'fork',  // fork (not cluster) preserves in-process socket state

      // ─── Restart Policy ───
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '15s',  // If crashed in < 15s, PM2 counts it as a bad restart
      restart_delay: 4000,
      max_memory_restart: '900M',
      exp_backoff_restart_delay: 200, // Exponential backoff between restarts

      // ─── Graceful Shutdown ───
      kill_timeout: 12000,           // 12s — enough for Baileys creds flush
      listen_timeout: 10000,
      shutdown_with_message: false,  // Use SIGTERM (no custom message needed)

      // ─── Logs ───
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // ─── Node.js Options ───
      node_args: '--max-old-space-size=1024 --expose-gc',

      // ─── Development Environment ───
      env: {
        NODE_ENV: 'development',
        PORT: 4025,
        WHATSAPP_MAX_RECONNECT_REQUESTS: 10,
        GRACEFUL_SHUTDOWN_TIMEOUT_MS: 12000,
      },

      // ─── Production Environment ───
      env_production: {
        NODE_ENV: 'production',
        PORT: 4025,
        // Session reconnect: 50 attempts before giving up (for VPS network blips)
        WHATSAPP_MAX_RECONNECT_REQUESTS: 50,
        // Backoff: start at 3s, cap at 90s — avoids hammering WhatsApp servers
        WHATSAPP_RECONNECT_BACKOFF_BASE_MS: 3000,
        WHATSAPP_RECONNECT_BACKOFF_MAX_MS: 90000,
        // QR: 3 minutes to scan (default 2m may be too tight in production)
        WHATSAPP_QR_TIMEOUT_MS: 180000,
        // Graceful shutdown window (Baileys creds flush needs ~5-8s)
        GRACEFUL_SHUTDOWN_TIMEOUT_MS: 12000,
        // Memory limit for /api/health degraded threshold
        HEALTH_MEMORY_LIMIT_MB: 800,
        // Crash exit on unhandled rejection in production (PM2 restarts)
        CRASH_EXIT_ON_UNHANDLED: 'true',
      },
    },
  ],
};

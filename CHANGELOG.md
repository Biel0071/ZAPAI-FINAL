# Changelog — ZAPAI

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-07-02

### Added
- **Database Bootstrap & Migration Stabilization**:
  - Added dynamic PostgreSQL configuration of `pg_hba.conf` and `postgresql.conf` (listen_addresses) on any Linux distribution (Ubuntu, Debian, AlmaLinux, Rocky Linux, CentOS).
  - Prepend TCP local trust rules in `pg_hba.conf` to allow seamless local TCP loopback authorization.
  - Safe verification and creation of role `zapai` and database `zapai_crm`, updating the password if they exist.
  - Generates complete `.env.production` including all Standard `POSTGRES_*` variables and legacy `DB_*` aliases to prevent empty fields.
  - Created a robust `wait-for-postgres` check loop prior to migrations.
  - Created a real query connection test using `psql` and the final `DATABASE_URL` (running `SELECT 1`) to guarantee connection before running migrations.
  - Added a final verification step checking PostgreSQL, Redis, Nginx, PM2, psql connection, and backend health before finishing.

## [1.1.0] - 2026-07-02

### Added
- **Universal Linux OS Deploy Support**:
  - Auto-detection of RHEL-based systems (AlmaLinux, Rocky Linux, RHEL, CentOS) alongside Debian-based systems (Ubuntu, Debian) inside `deploy/install.sh` using `/etc/os-release`.
  - Added auto-enabling of the **EPEL** repository on RHEL-based systems.
  - Added package manager wrappers (`install_packages`, `update_packages`, `enable_service`, `start_service`, `restart_service`) to automatically choose the correct command (`apt-get` or `dnf`).
  - Added support for AlmaLinux Node.js v20 module registration.
  - Added PostgreSQL automatic initialization (`postgresql-setup --initdb`) and database user/db creation on RHEL-based OS.
  - Added Redis RHEL/AlmaLinux service wrapper configuration.
  - Created Nginx compatibility layer directories (`/etc/nginx/sites-available`, `/etc/nginx/sites-enabled`) on RHEL-based installations and linked them automatically to `nginx.conf`.
  - Added Firewalld firewall configuration support using `firewall-cmd` alongside UFW support.
- **Cross-platform Deploy Script**:
  - Replaced the batch script (`ZAPAI-DEPLOY.bat`) with `scripts/deploy-vps.js`, a cross-platform Node.js script.
- **Web UI & REST API Deploy Controls**:
  - Added `POST /config/ai/deploy-vps` endpoint in `backend/routes/aiConfig.js`.
  - Added `deployVPS` API method in frontend `apiService.ts`.
  - Integrated the **Deploy VPS** button in `AIView.tsx` under the System Health status card.

### Fixed
- Fixed backend temperature resolving logic in `ai.service.js` to correctly support temperature `0` instead of falling back to default `0.6`.
- Fixed prompt system guidelines to make AI responses more natural, varied, and conversational.

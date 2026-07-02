# Changelog — ZAPAI

All notable changes to this project will be documented in this file.

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

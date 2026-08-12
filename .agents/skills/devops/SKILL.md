---
name: devops
description: Use for deployment, infrastructure configuration, containerization, web server setup, process management, and operational monitoring.
---

# Universal DevOps Skill

Provides infrastructure management guidelines for containerization, cloud deployment, web servers, and process managers.

## Infrastructure Detection Workflow

```
DETECT DEPLOYMENT TARGET:
- Containers: Docker, docker-compose, Podman
- Orchestration: Kubernetes, Helm
- Process Managers: PM2, systemd, supervisor
- Web Servers / Proxies: Nginx, Apache, Caddy, Traefik
- Cloud Platforms: Vercel, Cloudflare, AWS, GCP, Azure, Railway, Render

APPLY RULES ONLY FOR DETECTED INFRASTRUCTURE
```

## Universal DevOps Rules

1. **Environment Isolation**: Separate development, staging, and production configurations.
2. **Secrets Protection**: Secrets MUST be provided via secure environment variables or vault secrets. Never hardcode credentials in Dockerfiles, compose files, or Nginx configs.
3. **Health Checks**: Implement health check endpoints (`/health` or `/live`) for process managers, orchestrators, and load balancers.
4. **Graceful Shutdown**: Handle termination signals (`SIGTERM`, `SIGINT`) gracefully in background process loops.
5. **No Auto-Deploy**: Deployment to production environments requires explicit human authorization.

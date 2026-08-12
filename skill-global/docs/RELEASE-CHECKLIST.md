# Release Checklist — skill-global v1.0.0

Use this checklist before publishing `skill-global` to GitHub or NPM.

- [x] `npm test` — Test suite 100% PASS (`tests/test-runner.js`)
- [x] `npm pack --dry-run` — Package tarball contents verified (45 files, 0 secrets, 0 node_modules)
- [x] CLI Executable — `bin/skill-global.js` tested and working
- [x] `doctor` command — All health diagnostics PASS
- [x] `audit` command — 0 security/integrity issues
- [x] `verify` command — SHA-256 hashes match lockfile
- [x] Project Install — Tested in isolated temporary project (`skill-global-test-project`)
- [x] Uninstall — Clean removal tested
- [x] Secrets Safety — No credentials, `.env`, or tokens in package
- [x] Package Cleanliness — Clean standalone structure without host project code
- [x] Documentation — `README.md`, `CHANGELOG.md`, `docs/` complete
- [x] Git Status — Checked and clean (no uncommitted remote changes)
- [x] Ready to Publish — Prepared for GitHub remote and NPM publication

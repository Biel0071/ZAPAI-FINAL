---
name: qa
description: Use when running quality assurance suites, verifying builds, running unit/integration/E2E test runners, or generating test reports.
---

# Universal QA Skill

Provides test execution, build validation, and quality reporting across any tech stack.

## QA Detection Workflow

```
1. DETECT TEST RUNNER:
   - Node/JS: npm test / pnpm test / yarn test / bun test
   - Python: pytest / python -m unittest
   - Go: go test ./...
   - Rust: cargo test
   - Java: mvn test / ./gradlew test

2. DETECT FRAMEWORKS:
   - Unit/Integration: Vitest, Jest, Pytest, Go testing, JUnit
   - E2E / UI: Playwright, Cypress, Selenium

3. EXECUTE VALIDATION SUITE:
   - Build compilation check (e.g. tsc, vite build, go build, cargo check)
   - Unit test suite execution
   - Integration & E2E smoke tests
```

## Universal QA Checklist

- [ ] Execute compilation/type checks first.
- [ ] Run unit and integration tests.
- [ ] Verify test results: zero failing assertions.
- [ ] Verify build outputs compile without fatal errors.
- [ ] Log test execution summary.

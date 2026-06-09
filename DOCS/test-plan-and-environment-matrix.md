# SIGTS Test Plan and Environment Test Matrix

## 1) Purpose
This document defines a practical test plan for SIGTS and a clear environment matrix to verify quality before and after releases.

It is designed to ensure:
- account registration and login remain reliable,
- protected workflows are secure and role-correct,
- production deployments are validated quickly,
- regressions are detected early.

## 2) Scope
Included:
- Frontend web/PWA behavior for core user journeys.
- Backend API behavior, database interactions, auth, and role access.
- Notification behavior (email/SMS configured vs not configured).
- Production smoke checks and post-deploy validation.

Excluded:
- Deep penetration testing (handled in dedicated security assessments).
- Full load/performance certification at enterprise scale (separate exercise).

## 3) Test Objectives
- Validate critical user journeys for Tourist, Guide, IT Manager, and Admin.
- Verify new account creation can always log in.
- Confirm health, DB connectivity, and protected endpoint access in production.
- Ensure failures degrade gracefully (for example missing SMTP/Twilio).

## 4) Test Types and Minimum Coverage
- **Unit tests**
  - Auth helpers, normalization, notification reason mapping, guard logic.
  - Target: >= 80% coverage on critical auth/notification modules.

- **Integration tests**
  - Register -> login -> token use -> protected endpoint.
  - Duplicate account conflict handling.
  - Role-based access checks for admin endpoints.

- **API regression tests**
  - Core routes: auth, users/profile, animals/locations, admin/system-health.
  - Negative cases: wrong password, missing token, role mismatch.

- **UAT (role-based)**
  - Tourist, Guide, IT Manager scripted tasks.
  - Focus on usability and workflow completeness.

- **Smoke tests (post-deploy)**
  - `/api/health`, demo login, protected endpoint, new registration/login.
  - Pass/fail within 5-10 minutes.

- **Security baseline tests**
  - JWT authz checks, input validation checks, dependency scan, secret scan.

## 5) Entry and Exit Criteria
- **Entry criteria**
  - Environment is reachable.
  - Required migrations applied.
  - Seed/demo data available (for non-production smoke/UAT where needed).
  - Test credentials and base URLs are available.

- **Exit criteria**
  - No blocker/critical defects open.
  - All smoke tests pass.
  - Core auth/account scenarios pass in target environment.
  - Known medium/low issues documented with owner and fix timeline.

## 6) Environment Test Matrix

### Environment: Local Development
- **Purpose**
  - Fast developer feedback during implementation.
- **Data**
  - Local database + local seed/demo data.
- **Tests required**
  - Unit tests.
  - Integration tests.
  - API regression subset.
- **Tools**
  - Node test runner/Jest, Postman/Newman, browser devtools.
- **Gate**
  - No broken unit/integration tests before merge.

### Environment: Hosted Pre-Release (Staging-like)
- **Purpose**
  - Validate deployment behavior and realistic integration before production.
- **Data**
  - Hosted DB with non-sensitive test data.
- **Tests required**
  - Full API regression.
  - Role-based UAT scripts.
  - Notification behavior checks (configured and unconfigured paths).
  - Security baseline scan.
- **Tools**
  - Newman, scripted smoke runner, security scanners (SCA/secret scan/DAST-lite).
- **Gate**
  - All critical scenarios pass, no blocker defects.

### Environment: Production
- **Purpose**
  - Confirm service health and critical functionality after deployment.
- **Data**
  - Live production data.
- **Tests required**
  - Smoke tests only (safe, non-destructive).
  - Health, auth, protected endpoint checks, controlled registration/login check.
  - Log and alert review for runtime errors.
- **Tools**
  - PowerShell smoke script, curl/Invoke-RestMethod, Vercel logs.
- **Gate**
  - `/api/health` healthy + DB connected.
  - Login and protected endpoint check succeed.
  - No high-severity runtime errors in deployment logs.

## 7) Core Scenario Matrix (Must Always Pass)
- **Auth and Accounts**
  - Register new user -> login succeeds.
  - Existing user login succeeds with correct credentials.
  - Incorrect password returns controlled 401 response.
  - Inactive/deactivated account cannot log in.

- **Role and Access**
  - Tourist cannot access admin-only operations.
  - IT/Admin can access system-health and management endpoints.
  - Protected endpoints reject missing/invalid tokens.

- **System Health**
  - Health endpoint reports status healthy in production.
  - Database state reports connected.

- **Notification Behavior**
  - When SMTP/Twilio not configured: registration succeeds and reason codes are returned.
  - When SMTP/Twilio configured: delivery attempts are successful or errors are explicit.

## 8) Defect Severity and Response
- **Blocker**
  - Login broken, registration broken, health/db down.
  - Action: immediate hotfix, stop release.

- **High**
  - Role bypass, token auth failure in core flows.
  - Action: fix before release.

- **Medium**
  - Non-core endpoint issues, partial UX regressions.
  - Action: schedule in next sprint.

- **Low**
  - Cosmetic or minor messaging issues.
  - Action: backlog.

## 9) Execution Ownership
- **Developers**
  - Unit/integration/API regression in local and pre-release.
- **QA / Test Lead**
  - Regression packs, UAT coordination, defect triage.
- **DevOps/Release Owner**
  - Deployment verification, production smoke, log inspection.
- **Product Owner / Stakeholders**
  - UAT sign-off and release approval.

## 10) Release-Day Smoke Checklist (Operational)
- Confirm deployment completed successfully.
- Run production health check (`/api/health`).
- Execute demo account login and one protected endpoint call.
- Execute one fresh registration + login validation.
- Verify logs show no high-severity runtime failures.
- Record results in release note with timestamp and owner.

## 11) Suggested Artifacts to Maintain
- Smoke test script output (per deployment).
- API regression report (Newman or equivalent).
- UAT checklist and sign-off record.
- Defect tracker snapshot for release decision.
- Security scan summary (dependencies + secrets).

---

Prepared for SIGTS release governance and continuous quality assurance.

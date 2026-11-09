# Deviations from the SRS, SAD and STP

Peer-to-Peer Tutoring Scheduler (PTS-39). This list covers where the built system or the way the team worked differs from SRS v1.0, SAD v1.0 and STP v1.0 (all dated 27-10-2026).

How to read it: items marked **Verified** were checked against the code, CI workflow, schema or tests on `main`. Items marked **Not verified** could not be confirmed from the repository (for example, anything that lives only in Jira or GitHub settings).

The "Reason" column is the most likely explanation. The repository does not record decision reasons, so the team should confirm or reword them before the final demo.

## 1. Process and project management

| # | Documents say | What happened | Reason | Status |
|---|---|---|---|---|
| 1.1 | SAD 3.6 and 5.3: GitHub Projects for the backlog, sprints and story points, plus a Jira dashboard. | Jira only is used for tracking. Story keys (PTS-xx) are used in branch names, commits and PR titles. | One tracker is simpler for a small team. | Not verified (the tracker itself is outside the repo); the PTS-xx naming is visible in the commit history. |
| 1.2 | STP 5 (entry criteria): features are merged to a `develop` branch. | Pull requests are merged straight into `main`. There is no `develop` branch. | A single long-lived branch is enough for two short sprints. | Not verified (branch setup is a GitHub setting). The CI workflow runs on PRs and on pushes to `main` only. |
| 1.3 | SAD 3.6: on merge to `main`, deploy to staging and run smoke tests. | The CI job `smoke-staging` runs `scripts/smoke.sh` after merges to `main`. **This check is currently failing** on the health-check step, because the staging API did not answer. | Known issue. Staging (PTS-37) is a separate deployment from the code and still has to be fixed. It does not affect the checks on pull requests. | Verified: the job exists in `.github/workflows/ci.yml` and the script exists. The failure cause is based on the Actions log seen earlier, not re-checked in this document. **To be fixed later.** |
| 1.4 | SAD 3.6: CI builds a Docker image on every PR and deploys to staging from the pipeline. | The workflow has no Docker image build step and no deploy step. It waits 120 seconds, then runs the smoke test, which assumes staging redeploys by itself. | Docker is covered by `docker-compose.yml` and the Dockerfiles, and the hosting platform handles deployment. | Verified for the workflow contents. Whether staging auto-deploys is Not verified. |
| 1.5 | SAD 3.6: integration tests run as a separate stage with Postgres and Redis containers. | Unit and integration tests run together in one `backend` job (`npm test -- --coverage`) with Postgres and Redis service containers. | Simpler pipeline; the tests are in the same Jest suite. | Verified. |
| 1.6 | STP 5 and 5.2: Playwright (E2E), k6 (performance), OWASP ZAP and secret scanning in CI (TC-SEC-06). | Playwright (`e2e/`) and k6 (`perf/`) exist but are run by hand, not in CI. There is no ZAP or secret-scan step in CI. `npm audit --audit-level=high` runs instead. | Browser and load tests need a running stack, which the CI job does not start. | Verified for the workflow. Whether ZAP was run by hand is Not verified. |
| 1.7 | SRS NF-006: at least 70% backend coverage and ESLint with zero errors on every PR. | CI runs lint and `npm test -- --coverage`, but no coverage threshold is configured in `backend/package.json`, so a drop below 70% would not fail the build. | Not recorded. | Verified: no `coverageThreshold` found. The coverage figure itself is Not verified (the unit test report did not collect coverage). |
| 1.8 | PTS-39 includes a Sprint 2 demo video. | `videos/` contains only `Sprint1.mp4`. A Sprint 2 video is not in the repository. | Recording is done outside the code. | Verified: file listing. |

## 2. Features not built (future work)

| # | Documents say | What happened | Reason | Status |
|---|---|---|---|---|
| 2.1 | SRS F-023, SAD Review Service, STP TC-REV-01: learners rate (1 to 5) and review sessions, once per booking, with an average on the tutor profile. | **PTS-34, not built.** The `Review` table exists in the schema, but there is no review route, service or page. | Lower priority than booking, reminders and testing; left for a later release. | Verified: no review code in `backend/src` or `frontend/app`. |
| 2.2 | SRS F-024 (admin suspend users, hide abusive reviews), SRS 3.1 admin dashboard. | **PTS-35, not built.** There are no admin routes or pages. The only related code is the `suspended` field: a suspended user is refused at login with `ACCOUNT_SUSPENDED`, but nothing in the app can set that flag. | Low priority (L) in the SRS; left for a later release. | Verified. |
| 2.3 | SRS 3.3: optional iCalendar (.ics) export. | Not built. | It was marked optional. | Verified: no code found. |
| 2.4 | SRS F-016: when a booking is cancelled, both parties are notified. | Cancelling stops the reminders but sends no cancellation email. Emails are sent for confirmation, the 24 h and 1 h reminders, and for a tutor deleting a booked slot. | Cancellation email was not part of the stories delivered. | Verified: `DELETE /api/bookings/:id` only calls `cancelReminders`. |
| 2.5 | SRS F-011 and SAD 4.5: the learner's own bookings appear on the calendar with a "Mine" style and label. | The calendar page has no "Mine" marking. Own bookings are shown on the separate My bookings page. | Booking management was built as its own page to keep changes to the calendar small. | Verified: no such label in `frontend/app/calendar/page.js`. |
| 2.6 | SAD 3.9: audit log of booking state changes. SAD 3.9 also lists a per-learner booking cap. | No audit log table exists. The only limit is the rate limit of 20 booking requests per hour per user. | Not recorded. | Verified: schema and code. |

## 3. API, error codes and data model

| # | Documents say | What happened | Reason | Status |
|---|---|---|---|---|
| 3.1 | SAD 4.3 and STP TC-SLOT-03: tutor overlap returns 409 `TUTOR_OVERLAP`. | The code returns 409 `SLOT_OVERLAP` (create, edit and recurring create). | The name matches the resource (a slot) and the other `SLOT_*` codes. | Verified: `slotService.js`. |
| 3.2 | SAD 4.3 lists only `SLOT_TAKEN` and `LEARNER_OVERLAP` for booking errors. | More booking codes are returned: `OWN_SLOT` (403), `EMAIL_NOT_VERIFIED` (403), `SLOT_NOT_FOUND` (404), `SLOT_IN_PAST` (400), `BOOKING_NOT_FOUND` (404), `ALREADY_CANCELLED` (409), `TOO_LATE_TO_CANCEL` (409, inside 2 hours of the start), `SAME_SLOT` (400, reschedule to the same slot). | The SAD gives only the status text ("403 own slot or unverified"); each case needed its own code so the UI can show a clear message. | Verified. |
| 3.3 | SAD 4.3 lists 400, 401, 403, 409 for slots. | Also `INVALID_TIME_RANGE` (400), `SLOT_IN_PAST` (400), `SLOT_NOT_FOUND` (404), `SLOT_BOOKED` (409, editing a booked slot), `FORBIDDEN` (403, someone else's slot). | Same reason: one code per case. | Verified. |
| 3.4 | SAD 4.3 lists 401 and 409 for auth. | Also `INVALID_INPUT`, `INVALID_VERIFICATION_TOKEN`, `VERIFICATION_TOKEN_EXPIRED`, `EMAIL_ALREADY_VERIFIED` (all 400), and `ACCOUNT_SUSPENDED` (403). The code names for the SAD's 401 and 409 are `INVALID_CREDENTIALS` and `EMAIL_EXISTS`. | Email verification and suspension needed their own responses. | Verified. |
| 3.5 | SAD 4.4: error body is `{ error, message, details }`. | Same, plus the 429 `RATE_LIMITED` body has `details.retryAfterSeconds` and a `Retry-After` header. A 409 booking conflict also has `alternatives` at the top level (as the SAD shows), and `LEARNER_OVERLAP` adds `clashingBookingId`. Unknown routes return `NOT_FOUND`, unexpected errors return `INTERNAL_ERROR`. | These are additions on top of the SAD format, not changes to it. | Verified: `app.js`, `rateLimit.js`, `bookingService.js`. |
| 3.6 | SAD 4.3: `POST /api/slots` returns 201 `{ created: [ { slotId, start, end } ] }`; `repeatWeeks` is 0 to 8. | A single slot returns the slot object (`id`, `tutorId`, `subject`, `start`, `end`, `mode`, `link`, `status`). A recurring request returns `{ count, slots: [...] }`. `repeatWeeks` accepts 1 to 8 (leave it out for a single slot). | The same slot object is used by every slot endpoint. | Verified: `routes/slots.js`, `slotService.js`. |
| 3.7 | SAD 4.3: slot browse filters are `subject`, `tutor`, `from`, `to`, `mode`. | The filter is `tutorId` (a tutor id, chosen from a dropdown), not a tutor name. The calendar sends `from` and `to` from the visible calendar range; there is no separate date-range input. | An id is exact; the dropdown is filled by `GET /api/slots/tutors`. | Verified. |
| 3.8 | SAD 4.3 lists the endpoints for auth, slots and bookings. | Extra endpoints exist: `POST /api/auth/verify-email` and `GET /api/auth/verify-email`, `GET /api/auth/me`, `PUT /api/auth/tutor-profile`, `GET /api/slots/tutors`. All slot browsing needs login. | Needed for email verification (F-002), tutor profiles (F-004) and the calendar filter. | Verified: `routes/auth.js`, `routes/slots.js`. |
| 3.9 | SAD 4.3: `POST /api/auth/login` returns `{ token, user }`. | Same. Register and tutor-profile update also return `{ token, user }`; the tutor-profile call issues a new token because the role changes. | The new role has to appear in the token. | Verified: `authService.js`. |
| 3.10 | SAD 4.4: `GET /api/health` checks the database and Redis. | It returns `{ "status": "ok" }` and checks neither. | Kept simple so the endpoint always answers for the staging smoke test. | Verified: `app.js`. |
| 3.11 | SAD 3.4 data model: `reviews(rating, comment)` and `bookings(... created_at)`, `email_logs`. | Bookings also have a `note` column (SAD 4.3 request includes `note`). `EmailLog.status` takes the values `SENT`, `RETRYING` and `FAILED`. Slots have a `CANCELLED` status as well as `FREE` and `BOOKED`: a tutor deleting a slot that has booking history cancels it instead of removing the row. | Needed to keep booking history and to keep the email log accurate. | Verified: `schema.prisma`, `emailWorker.js`, `slotService.js`. |
| 3.12 | SAD 4.3 reschedule: `PATCH /api/bookings/{id} { newSlotId }`. | Same. A new booking row is created and the old one is set to CANCELLED, in one transaction. The response includes `oldBookingId`. The 2-hour cancellation window applies. | A new row keeps the history of each booking. | Verified: `bookingService.js`. |

## 4. Authentication and security

| # | Documents say | What happened | Reason | Status |
|---|---|---|---|---|
| 4.1 | SAD 3.9: JWT with a short expiry. | Tokens last **7 days** (`expiresIn: "7d"`). They are signed with `JWT_SECRET` using the library default algorithm; the payload is `{ id, email, role }`. There is no refresh token. | Fewer logins for the demo; no refresh flow was built. | Verified: `authService.js`. |
| 4.2 | SRS SR-001: cookies must be Secure and HttpOnly. | The token is sent as `Authorization: Bearer ...` and the frontend keeps it in `localStorage`. No cookies are used. | A separate API origin and Axios with bearer headers was the simpler setup. | Verified: `middleware/auth.js`, frontend pages use `localStorage`. HTTPS on staging is Not verified. |
| 4.3 | SAD 3.9: role stored server-side; RBAC middleware on every route. | The role is read from the token and not re-checked in the database on each request. The same applies to `suspended`: a user suspended after login keeps a working token until it expires. Routes without `requireRole` use `auth` plus ownership checks in the service. | Avoids a database lookup per request. | Verified: `middleware/auth.js`, `middleware/rbac.js`. |
| 4.4 | SRS SR-004: 5 failed logins per 15 minutes and 20 bookings per hour are rate-limited. | Implemented as specified (Redis, with an in-memory fallback if Redis is unavailable). The login limiter counts failed attempts (400 or 401 responses) per client IP address; the booking limiter is per user id. | None; listed only because the in-memory fallback is not in the SAD. | Verified: `rateLimit.js`. |
| 4.5 | SAD 4.4: structured JSON logs (pino) with request ID; secrets and emails masked. | `pino` and `pino-http` are installed but not used. The code logs with `console.log` and `console.error`; no request ID and no masking. | Not recorded. | Verified: no pino usage in `backend/src`. |
| 4.6 | SAD 3.6: email through SendGrid or Mailtrap. | Nodemailer over SMTP only (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). No SendGrid API client. | SendGrid and Mailtrap both work through SMTP. | Verified: `lib/mailer.js`. |
| 4.7 | SRS SR-005 / STP TC-SEC-05: OWASP ZAP baseline scan. | Zod validation (strict schemas) and Prisma are in place, but no ZAP scan result is in the repository. | Not recorded. | Not verified. |

## 5. Other differences

| # | Documents say | What happened | Reason | Status |
|---|---|---|---|---|
| 5.1 | SAD 3.6: Testing uses Jest, Supertest, React Testing Library, Playwright and k6. | React Testing Library is not used; there are no frontend unit tests. | Frontend behaviour was covered by the Playwright tests instead. | Verified: frontend `package.json` has no test dependencies. |
| 5.2 | SAD 4.5: calendar is the home page; mobile defaults to the day/list view. | The home page (`/`) is a landing page with links; the calendar is at `/calendar`. Mobile default view: Not verified. | The landing page holds the sign-in, register and navigation links. | Verified for the home page. |
| 5.3 | SAD 4.5 and SRS NF-004: WCAG AA contrast. | The automated accessibility scan reports contrast problems on the calendar and My slots pages. See the system validation report (PTS-44). | Not fixed in Sprint 2. | Based on the PTS-44 report; Not verified here. |
| 5.4 | SRS NF-001: p95 under 500 ms at 100 users. | The k6 run met the latency target, but most booking requests in that run were rate-limited, so the booking path is not fully measured. See section 3 of the system validation report (PTS-44). | The booking limiter (20 per hour per user) is hit by the load test users. | Based on the PTS-44 report; Not verified here. |
| 5.5 | SAD 3.4: component layout (Auth Service, Slot Service, ...). | The code follows it, with two unused leftovers: `routes/auth.routes.js` and `services/auth.service.js` (an early register-only version). `app.js` mounts only `routes/auth.js`. | Left behind during the merge of two auth implementations. | Verified: nothing imports `auth.routes.js`. |

## 6. Items to double-check before the final demo

- Whether the Sprint 2 video is recorded and where it is stored (not in the repository).
- The smoke test check stays red on merges to `main` until staging is restored.
- The coverage percentage (SRS NF-006) is not recorded anywhere yet.
- The Requirements Traceability Matrix statuses are updated separately (see the RTM document), not in this file.

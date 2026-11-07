# Test Cases and Requirements Traceability Matrix (RTM)

Peer-to-Peer Tutoring Scheduler, updated to match the system as built (PTS-42).

This document replaces the sample test case table in the STP (section 5.1) and the RTM stub in the SRS (section 8). Everything below was checked against the code in this repository and a real test run. Anything that could not be checked is marked **Not verified**.

## 0. Test run used for the Status column

| Item | Value |
|---|---|
| Date of run | 2026-11-07 |
| Command | `cd backend && npx jest --coverage` (run twice; both runs identical) |
| Backend result | 15 test suites, 106 tests: **106 passed, 0 failed, 0 skipped** |
| Backend coverage | 89.47% statements, 77.77% branches, 88.54% functions, 91.21% lines |
| Lint | `cd backend && npm run lint`: 0 errors |
| Jest version | 30.5.2 |
| Node (this run) | v24.10.0 (CI uses Node 20) |
| Database | PostgreSQL 16 (Docker, `docker compose up -d db`), all 3 migrations applied |
| Redis | Local Redis on port 6379 (needed by `emailRetry.redis.test.js`) |
| E2E (Playwright) | **Not run** in this update. The 10 specs in `e2e/tests` need browsers plus the backend and frontend running, and no CI job runs them. |
| Performance (k6) | **Not run** in this update. `perf/booking-load.js` needs k6 and a running backend. |

Status key:

- **Passed**: an automated test exists and passed in the run above.
- **Failed**: an automated test exists and failed (none in this run).
- **Not run**: a test exists in the repo but was not executed in this update.
- **No test**: no test with this ID exists in the code.
- **Not built**: the feature itself does not exist in the code.
- **Not verified**: could not be checked from the code or the run.

---

## (a) Test cases that exist in the code

### Backend automated tests (Jest and Supertest, run above)

| TC ID | Req ID | What it checks | Expected result | Test file(s) | Tests | Status |
|---|---|---|---|---|---|---|
| TC-AUTH-01 | P2P-F-001, SR-002 | Register with a new email; duplicate email; missing name, bad email, short password; bcrypt cost 12 on the stored hash | 201 with token and safe user (no password hash); duplicate gives 409 `EMAIL_EXISTS`; bad input gives 400 `INVALID_INPUT` | `auth.test.js` | 5 | Passed |
| TC-AUTH-02 | P2P-F-002 | Email verification: valid token verifies and is consumed; expired token rejected; verification email is sent with a matching token and HTML-escaped name; registration works when the mail server is down; unverified learners cannot book | Verified account can book; expired token rejected; unverified learner gets 403 `EMAIL_NOT_VERIFIED` before the slot is read | `auth.test.js`, `verificationEmail.test.js`, `booking-verification.test.js` | 6 | Passed |
| TC-AUTH-03 | P2P-F-003, SR-003 | Login with valid and invalid credentials; JWT accepted on a protected endpoint; request without JWT | Valid login returns a JWT without the password hash; invalid login gives a generic 401; no JWT gives 401 | `auth.test.js` | 4 | Passed |
| TC-PROF-01 | P2P-F-004 | `PUT /api/auth/tutor-profile`: promotes user to tutor with subjects and bio; rejects empty profile; requires JWT | Tutor role, subjects and bio saved with a refreshed token; invalid input 400; no token 401 | `auth.test.js` | 3 | Passed |
| TC-SLOT-02 | P2P-F-006, P2P-F-007, P2P-F-005 | Weekly recurring slots (`repeatWeeks` 4 and 8 create exactly that many, 7 days apart; 9, 0, -1, 2.5 rejected; omitted gives one slot). Also contains the tutor overlap checks (single and series), time-range and past-start validation, role checks, and the reusable overlap helper | Correct number of slots; overlap gives 409 `SLOT_OVERLAP` with nothing created; invalid range 400 `INVALID_TIME_RANGE`; past start 400 `SLOT_IN_PAST`; learner 403; no token 401 | `slots.test.js` | 11 | Passed |
| TC-SLOT-04 | P2P-F-008 | Edit and delete slots: tutor edits own free slot; edit that overlaps rejected; booked slot cannot be edited (409 `SLOT_BOOKED`); deleting a booked slot cancels the booking and queues a cancellation email per learner; other tutor, learner and unknown id rejected | 204 on delete; booking CANCELLED; `SLOT_CANCELLED` email sent; 403 `FORBIDDEN` for non-owner; 404 `SLOT_NOT_FOUND` | `slots.test.js` | 7 | Passed |
| TC-CAL-03 | P2P-F-011 | `GET /api/bookings/me` returns the learner's confirmed bookings in calendar-ready form; requires JWT | List of own bookings; no token 401 (API only, see deviation 7) | `my-bookings.test.js` | 2 | Passed |
| TC-BOOK-01 | P2P-F-012 | Book a free slot | 201 `{ bookingId, slotId, start, end, status: "CONFIRMED" }`; slot becomes BOOKED | `bookings.test.js` | 1 | Passed |
| TC-BOOK-02 | P2P-F-013 | 10 simultaneous requests from different learners for one slot | Exactly one 201 and nine 409 `SLOT_TAKEN`; exactly one CONFIRMED booking in the database | `bookings.test.js` | 1 | Passed |
| TC-BOOK-03 | P2P-F-014 | Same learner books two overlapping slots from different tutors | Second returns 409 `LEARNER_OVERLAP` with `clashingBookingId`; second slot stays FREE | `bookings.test.js` | 1 | Passed |
| TC-BOOK-04 | P2P-F-015 | Conflict returns alternatives: up to 3, same subject, free, future, nearest first, same tutor first, never the learner's own or overlapping slots; empty list when none; also on `LEARNER_OVERLAP`; absent on success and other errors | 409 with top-level `alternatives` array of at most 3 | `bookings.test.js` | 6 | Passed |
| TC-BOOK-05 | P2P-F-016 | Cancel 3 h before start; cancel 1 h before; another learner cancels | 3 h: 200, slot FREE and re-bookable; 1 h: 409 `TOO_LATE_TO_CANCEL`, nothing changes; other learner: 403 | `bookings.test.js` | 3 | Passed |
| TC-BOOK-06 | P2P-F-017 | Reschedule (`PATCH /api/bookings/:id`): success moves the booking and frees the old slot; failed reschedule (slot taken, overlap) leaves everything unchanged; two simultaneous reschedules into one slot; route removes old reminders and confirms the new booking | 200 with new `bookingId` and `oldBookingId`; failure leaves original CONFIRMED; exactly one of two simultaneous attempts succeeds | `bookings.test.js`, `rescheduleNotifications.test.js` | 5 | Passed |
| TC-BOOK-07 | P2P-F-018 | Tutor books their own slot | 403 `OWN_SLOT` | `bookings.test.js` | 1 | Passed |
| TC-NOTIF-01 | P2P-F-019 | New booking queues a confirmation; worker sends one email to learner and one to tutor and logs it | Confirmation job queued; two emails sent; email log written (mailer is mocked, 1-minute delivery not measured) | `notification.test.js`, `bookingNotifications.test.js` | 2 | Passed |
| TC-NOTIF-02 | P2P-F-020 | Slot 2 days ahead gets two delayed reminder jobs | Jobs at T-24h and T-1h | `reminders.test.js` | 1 | Passed |
| TC-NOTIF-03 | P2P-F-021 | Cancelling removes pending reminders; worker sends no reminder for a cancelled booking; route cancels reminders | No reminder sent after cancellation | `reminders.test.js`, `bookingNotifications.test.js` | 3 | Passed |
| TC-NOTIF-04 | P2P-F-022 | Failing mailer: logged RETRYING while retries remain, then FAILED; real queue and worker against Redis: 3 retries then FAILED log | 3 retries, then email log status FAILED | `emailRetry.test.js`, `emailRetry.redis.test.js` | 2 | Passed |
| TC-SEC-04 | P2P-SR-004 | 6th failed login within the window; 21st booking attempt by one learner | 429 | `rate-limit.test.js` | 2 | Passed |
| TC-SEC-05 | P2P-SR-005 | Unexpected fields rejected on register, booking and slot creation, before database access | 400 | `validation.test.js` | 3 | Passed |

### End-to-end and accessibility tests (Playwright, `e2e/tests`)

| TC ID | Req ID | What it checks | Expected result | Test file | Status |
|---|---|---|---|---|---|
| TC-AUTH-01 | P2P-F-001 | Register with a new email, then again with the same email | First succeeds; second rejected | `auth.spec.js` | Not run |
| TC-AUTH-03 | P2P-F-003 | Login with a wrong password | Error shown, no token stored | `auth.spec.js` | Not run |
| TC-CAL-02 | P2P-F-010 | Calendar filter subject = DBMS | Only DBMS slots shown | `calendar.spec.js` | Not run |
| TC-UX-02 | P2P-NF-005 | New user books from the calendar | Confirmed booking in 3 clicks or fewer | `calendar.spec.js` | Not run |
| TC-BOOK-01 | P2P-F-012 | Learner books a free slot in the browser | Appears in My bookings; slot shows booked | `booking.spec.js` | Not run |
| TC-BOOK-05 | P2P-F-016 | Learner cancels a booking more than 2 h away in the browser | Booking removed; slot free again | `booking.spec.js` | Not run |
| TC-SLOT-02 | P2P-F-006 | Tutor creates weekly recurring slots (4 weeks) on `/my-slots` | 4 slots appear | `slots.spec.js` | Not run |
| TC-SLOT-04 | P2P-F-008 | Tutor edits a free slot and deletes a slot on `/my-slots` | Changes saved; slot deleted | `slots.spec.js` | Not run |
| TC-UX-01 | P2P-NF-004 | axe WCAG 2.1 AA scan at 1280 px and 360 px, and a keyboard-only booking flow | No serious violations; booking possible by keyboard | `a11y.spec.js` | Not run |

### Performance test (k6)

| TC ID | Req ID | What it checks | Expected result | File | Status |
|---|---|---|---|---|---|
| TC-PERF-01 | P2P-NF-001 | 100 virtual users for 5 minutes; mix of slot browsing, tutor list, my bookings and booking attempts | p95 under 500 ms, error rate under 1% | `perf/booking-load.js` | Not run |

### Staging smoke script (no TC ID)

`scripts/smoke.sh` checks health, login and an authenticated `GET /api/slots` against the staging URL. CI runs it in the `smoke-staging` job after a push to `main` or a manual run. It passed against a local backend. See the known issue at the end of section (d).

---

## (b) Test cases added that were not in the STP

The STP sample table has no IDs for these tests. They exist in the code without a TC ID, so they are listed by file and behaviour. The 37 tests below are in addition to the 69 tagged tests in section (a).

| Area | Test file | Tests | What they check | Status |
|---|---|---|---|---|
| Health | `health.test.js` | 1 | `GET /api/health` returns ok | Passed |
| Booking input, auth and rules | `bookings.test.js` | 7 | Unknown slot 404; invalid input 400; past slot 400; slot already booked 409 `SLOT_TAKEN`; no token 401; invalid token 401 and the old `x-user-id` header is ignored; a tutor can book another tutor's slot | Passed |
| Booking concurrency and overlap extras | `bookings.test.js` | 4 | Back-to-back slots allowed; cancelled bookings ignored for overlap; one learner firing two overlapping requests at once gets one 201 and one `LEARNER_OVERLAP`; database unique index rejects a second CONFIRMED booking for one slot | Passed |
| Cancel and my-bookings extras | `bookings.test.js` | 5 | Unknown booking 404 and malformed id 400; second cancel 409 `ALREADY_CANCELLED`; no token 401; `GET /me` returns only the caller's bookings, upcoming first; `GET /me` without token 401 | Passed |
| Reschedule extras | `bookings.test.js` | 8 | Note carried over; a booking does not clash with itself; same rules as booking (own slot, past slot); unknown slot or booking 404, same slot and bad input 400; other learner 403; cancellation window 409 `TOO_LATE_TO_CANCEL`; cancelled booking 409 and no token 401; one booking rescheduled twice at once ends with one confirmed booking | Passed |
| Reschedule notifications | `rescheduleNotifications.test.js` | 2 | Nothing queued or cancelled when the reschedule is rejected; body without `newSlotId` gives 400 | Passed |
| Booking and cancel notifications | `bookingNotifications.test.js` | 2 | Nothing queued when the booking is rejected; reminders kept when the cancel is refused | Passed |
| Confirmation email | `notification.test.js` | 3 | One confirmation job per booking; no throw when the queue is down; nothing sent for a cancelled booking | Passed |
| Reminders | `reminders.test.js` | 3 | Reminder whose time has passed is skipped; no reminders for a slot starting in 30 minutes; no throw when the queue is down | Passed |
| Email retry | `emailRetry.test.js`, `emailRetry.redis.test.js` | 2 | RETRYING logged while retries remain; a mailer that fails once then works is logged RETRYING, then SENT | Passed |

---

## (c) Requirements Traceability Matrix

Modules follow the SRS RTM and the folders in this repository. "Passed" means the Jest test passed in the run in section 0.

### Functional requirements

| Req ID | Requirement | Module | Test case(s) | Status |
|---|---|---|---|---|
| P2P-F-001 | Register | Auth Service | TC-AUTH-01 (Jest); TC-AUTH-01 (e2e) | Passed (Jest); e2e Not run |
| P2P-F-002 | Email verification before booking | Auth Service | TC-AUTH-02 | Passed |
| P2P-F-003 | Login with JWT | Auth Service | TC-AUTH-03 (Jest); TC-AUTH-03 (e2e) | Passed (Jest); e2e Not run |
| P2P-F-004 | Enable tutor role, subjects and bio | Auth Service | TC-PROF-01 | Passed |
| P2P-F-005 | Create slot | Slot Service | TC-SLOT-01 (no test with this ID); creation is covered inside TC-SLOT-02 tests | Passed (as TC-SLOT-02) |
| P2P-F-006 | Weekly recurring slots, up to 8 weeks | Slot Service | TC-SLOT-02 (Jest); TC-SLOT-02 (e2e) | Passed (Jest); e2e Not run |
| P2P-F-007 | No overlapping tutor slots | Slot Service | TC-SLOT-03 (no test with this ID); covered by overlap tests labelled TC-SLOT-02 | Passed (as TC-SLOT-02) |
| P2P-F-008 | Edit or delete a slot; deleting a booked slot cancels the booking and notifies the learner | Slot Service, Notification Service | TC-SLOT-04 (Jest); TC-SLOT-04 (e2e) | Passed (Jest); e2e Not run |
| P2P-F-009 | Month, week and day calendar views | Calendar UI | TC-CAL-01 (no test). Views exist in `frontend/app/calendar/page.js` | No test |
| P2P-F-010 | Filter slots by subject, tutor, date range, mode | Calendar UI, Slot Service | TC-CAL-02 (e2e only) | Not run |
| P2P-F-011 | Own bookings on the calendar in a distinct style | Calendar UI, Booking Service | TC-CAL-03 (API only) | Passed (API); calendar style Not built (deviation 7) |
| P2P-F-012 | Reserve a free slot | Booking Service | TC-BOOK-01 (Jest); TC-BOOK-01 (e2e) | Passed (Jest); e2e Not run |
| P2P-F-013 | Concurrency-safe booking | Booking Service | TC-BOOK-02 | Passed |
| P2P-F-014 | Learner overlap check | Booking Service | TC-BOOK-03 | Passed |
| P2P-F-015 | Up to 3 alternative slots on conflict | Booking Service, Calendar UI | TC-BOOK-04 | Passed |
| P2P-F-016 | Cancel up to 2 h before start | Booking Service | TC-BOOK-05 (Jest); TC-BOOK-05 (e2e) | Passed (Jest); e2e Not run. "Both parties notified" Not built (deviation 6) |
| P2P-F-017 | Reschedule atomically | Booking Service | TC-BOOK-06 | Passed |
| P2P-F-018 | Block booking own slot | Booking Service | TC-BOOK-07 | Passed |
| P2P-F-019 | Confirmation email to tutor and learner | Notification Service | TC-NOTIF-01 | Passed (mailer mocked; 1-minute delivery not measured) |
| P2P-F-020 | Reminder jobs 24 h and 1 h before | Reminder Worker | TC-NOTIF-02 | Passed |
| P2P-F-021 | Skip reminders for cancelled bookings, reschedule them for moved bookings | Reminder Worker | TC-NOTIF-03; moved bookings via TC-BOOK-06 | Passed |
| P2P-F-022 | Retry failed emails 3 times, log final failure | Reminder Worker | TC-NOTIF-04 | Passed |
| P2P-F-023 | Ratings and reviews | Review Service | TC-REV-01 | Not built (deviation 8) |
| P2P-F-024 | Admin suspends users, hides reviews | Admin | TC-ADM-01 | Not built (deviation 8) |

### Non-functional requirements

| Req ID | Requirement | Module | Test case(s) | Status |
|---|---|---|---|---|
| P2P-NF-001 | p95 under 500 ms at 100 users | API / DB | TC-PERF-01 (`perf/booking-load.js`) | Not run |
| P2P-NF-002 | Calendar first paint under 2 s | Frontend | TC-PERF-02 | No test |
| P2P-NF-003 | Reminder jobs survive restarts | Job Queue | TC-REL-01 | No test |
| P2P-NF-004 | Responsive UI and WCAG 2.1 AA | Frontend | TC-UX-01 (`a11y.spec.js`) | Not run |
| P2P-NF-005 | First booking in 3 clicks or fewer | Calendar UI | TC-UX-02 (`calendar.spec.js`) | Not run |
| P2P-NF-006 | 70% backend coverage and zero lint errors | CI | TC-CI-01 (no test with this ID; measured in CI run) | Passed: 89.47% statements, lint 0 errors (threshold not enforced, deviation 12) |
| P2P-NF-007 | Runs with one `docker compose up` on any OS | Docker | TC-PORT-01 | Not verified (`docker-compose.yml` exists; not run on 3 operating systems) |

### Security requirements

| Req ID | Requirement | Module | Test case(s) | Status |
|---|---|---|---|---|
| P2P-SR-001 | HTTPS; Secure and HttpOnly cookies | API / Frontend | TC-SEC-01 | Not verified (no cookies are used, see deviation 2; HTTPS on staging not checked) |
| P2P-SR-002 | bcrypt cost 12 or higher; never logged | Auth Service | TC-SEC-02 (no test with this ID). Cost 12 is asserted inside the TC-AUTH-01 test | Passed (hash cost); logging Not verified |
| P2P-SR-003 | Role-based access and ownership checks | API (`requireRole`, ownership checks) | TC-SEC-03 (no test with this ID). 403 cases are asserted in TC-SLOT-04, TC-BOOK-05 and the reschedule tests | Passed (covered indirectly) |
| P2P-SR-004 | Rate limiting (5 failed logins per 15 min, 20 bookings per hour) | API (`middleware/rateLimit.js`) | TC-SEC-04 | Passed |
| P2P-SR-005 | Server-side validation and parameterised queries | API | TC-SEC-05 | Passed (validation); OWASP ZAP scan Not run |
| P2P-SR-006 | Secrets in environment variables, never in the repo | CI / config | TC-SEC-06 | Not verified (`JWT_SECRET` comes from a GitHub secret; no secret-scanning step exists in `ci.yml`) |

---

## (d) Deviations from the original STP, SRS and SAD

Each item is verified in the code unless marked otherwise.

1. **Tutor overlap error code is `SLOT_OVERLAP`, not `TUTOR_OVERLAP`** (STP TC-SLOT-03). See `backend/src/services/slotService.js`.
2. **JWT in the `Authorization: Bearer` header, stored in browser `localStorage`, not Secure/HttpOnly cookies** (SRS P2P-SR-001). See `backend/src/middleware/auth.js` and the frontend login and register pages.
3. **Jira only, not GitHub Projects plus Jira** (STP section 6). This is a team decision and is not visible in the code: **Not verified**.
4. **Pull requests merge into `main`, not `develop`** (STP entry criteria). `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`.
5. **Some STP test case IDs are not used in the code.** TC-SLOT-01 and TC-SLOT-03 are covered by tests labelled TC-SLOT-02. TC-SEC-02 and TC-SEC-03 are covered inside tests labelled TC-AUTH-01, TC-SLOT-04 and TC-BOOK-05. TC-CAL-01, TC-REL-01, TC-PERF-02, TC-SEC-01, TC-SEC-06, TC-PORT-01, TC-CI-01, TC-REV-01 and TC-ADM-01 have no test.
6. **Learner cancel does not notify both parties** (SRS P2P-F-016). `DELETE /api/bookings/:id` only removes the pending reminders. The only cancellation email is `SLOT_CANCELLED`, sent to learners when a tutor deletes a booked slot (P2P-F-008).
7. **Own bookings are not shown on the calendar in a distinct style** (SRS P2P-F-011). The calendar only colours slots Free or Booked. A learner's own bookings are on the separate `/my-bookings` page. The API `GET /api/bookings/me` exists and is tested (TC-CAL-03).
8. **Reviews (P2P-F-023) and admin moderation (P2P-F-024) are not built.** `schema.prisma` has `Review` and `User.suspended`, but there are no routes, services, pages or tests. Login already refuses suspended users with 403 `ACCOUNT_SUSPENDED`, but no test covers it.
9. **Extra error codes beyond the SAD:** `INVALID_INPUT`, `SLOT_IN_PAST`, `SLOT_NOT_FOUND`, `BOOKING_NOT_FOUND`, `ALREADY_CANCELLED`, `SAME_SLOT`, `FORBIDDEN`, `SLOT_BOOKED`, `EMAIL_NOT_VERIFIED`, `RATE_LIMITED`, `INVALID_TIME_RANGE`, `SLOT_OVERLAP`. Error bodies also carry `message` and `details` next to `error`. For `LEARNER_OVERLAP` the body adds `clashingBookingId`, and for `SLOT_TAKEN` and `LEARNER_OVERLAP` it adds a top-level `alternatives` array.
10. **Reschedule creates a new booking and cancels the old one.** The response is `{ bookingId, oldBookingId, slotId, start, end, status }`. The 2-hour cancellation window applies to the old slot. Choosing a slot of the same subject is a user-interface rule only; the API accepts any free slot.
11. **Alternatives use "nearest in start time", same tutor first** (SRS P2P-F-015 does not define "nearest"). Each item is `{ slotId, tutorId, tutorName, subject, start, end, mode }`.
12. **The 70% coverage target is not enforced in CI** (SRS P2P-NF-006). CI runs `npm test -- --coverage` but `backend/package.json` has no `coverageThreshold`. The measured value is 89.47% statements.
13. **No secret-scanning step in CI** (STP TC-SEC-06). `ci.yml` has no such job.
14. **CI additions not in the STP:** `npm audit --audit-level=high` in the backend job, and a `smoke-staging` job that runs on pushes to `main` and manual runs.
15. **E2E and k6 tests are not part of CI.** No job in `ci.yml` runs the Playwright or k6 tests, so they were **Not run** here.
16. **Email delivery is tested with a mocked mailer**, not a Mailtrap sandbox inbox, and the "within 1 minute" target (P2P-F-019) is not measured. Whether Mailtrap is used on staging is **Not verified**.
17. **Rate limiting uses Redis with an in-memory fallback**, and in-memory counters under test (`backend/src/middleware/rateLimit.js`).
18. **Known issue, not a code defect:** the `smoke-staging` job fails on pushes to `main` because the staging API on Render does not answer its health check (observed in the GitHub Actions log). Backend and frontend jobs pass in the same runs.

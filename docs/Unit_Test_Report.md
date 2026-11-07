# Unit Test Report

Peer-to-Peer Tutoring Scheduler, backend test suite (PTS-43).

Generated from the raw Jest output in [`unit-test-results.json`](unit-test-results.json). All numbers below come from that file.

## 1. Run details

| Item | Value |
|---|---|
| Date of run | 2026-11-07 11:22 UTC |
| Command | `cd backend && npx jest --json --outputFile=../docs/unit-test-results.json` |
| Node.js | v24.10.0 (CI uses Node 20) |
| Jest | 30.5.2 (with Supertest) |
| Operating system | macOS (Darwin 24.6.0) |
| Database | PostgreSQL 16 in Docker, all 3 Prisma migrations applied |
| Redis | Local Redis on port 6379 (used by `emailRetry.redis.test.js`) |
| Total run time | 5.39 s |

## 2. Summary

| Metric | Count |
|---|---|
| Test suites (files) | 15 |
| Suites passed | 15 |
| Suites failed | 0 |
| Tests total | 106 |
| Tests passed | 106 |
| Tests failed | 0 |
| Tests skipped | 0 |
| Tests todo | 0 |
| Overall result | PASSED |

## 3. Results per test file

| File | Tests | Passed | Failed | Skipped | Time |
|---|---|---|---|---|---|
| `backend/tests/auth.test.js` | 14 | 14 | 0 | 0 | 4.97 s |
| `backend/tests/booking-verification.test.js` | 1 | 1 | 0 | 0 | 0.04 s |
| `backend/tests/bookingNotifications.test.js` | 4 | 4 | 0 | 0 | 0.67 s |
| `backend/tests/bookings.test.js` | 41 | 41 | 0 | 0 | 4.42 s |
| `backend/tests/emailRetry.redis.test.js` | 2 | 2 | 0 | 0 | 2.23 s |
| `backend/tests/emailRetry.test.js` | 2 | 2 | 0 | 0 | 0.42 s |
| `backend/tests/health.test.js` | 1 | 1 | 0 | 0 | 1.24 s |
| `backend/tests/my-bookings.test.js` | 2 | 2 | 0 | 0 | 1.19 s |
| `backend/tests/notification.test.js` | 4 | 4 | 0 | 0 | 0.32 s |
| `backend/tests/rate-limit.test.js` | 2 | 2 | 0 | 0 | 2.48 s |
| `backend/tests/reminders.test.js` | 6 | 6 | 0 | 0 | 0.34 s |
| `backend/tests/rescheduleNotifications.test.js` | 3 | 3 | 0 | 0 | 0.81 s |
| `backend/tests/slots.test.js` | 18 | 18 | 0 | 0 | 3.79 s |
| `backend/tests/validation.test.js` | 3 | 3 | 0 | 0 | 2.20 s |
| `backend/tests/verificationEmail.test.js` | 3 | 3 | 0 | 0 | 2.21 s |

## 4. Every test, by file

### 4.1 `backend/tests/auth.test.js`

| # | Test | Result |
|---|---|---|
| 1 | Auth Registration - TC-AUTH-01 (F-001, SR-002) successfully registers a new user and returns 201 with token and safe user profile | Pass |
| 2 | Auth Registration - TC-AUTH-01 (F-001, SR-002) rejects registration with duplicate email and returns 409 Conflict | Pass |
| 3 | Auth Registration - TC-AUTH-01 (F-001, SR-002) returns 400 when name is missing or empty | Pass |
| 4 | Auth Registration - TC-AUTH-01 (F-001, SR-002) returns 400 when email format is invalid | Pass |
| 5 | Auth Registration - TC-AUTH-01 (F-001, SR-002) returns 400 when password is shorter than 8 characters | Pass |
| 6 | Auth Registration - TC-AUTH-01 (F-001, SR-002) PUT /api/auth/tutor-profile (F-004, TC-PROF-01) promotes the authenticated user and returns a refreshed tutor JWT | Pass |
| 7 | Auth Registration - TC-AUTH-01 (F-001, SR-002) PUT /api/auth/tutor-profile (F-004, TC-PROF-01) rejects tutor profiles without subjects or bio | Pass |
| 8 | Auth Registration - TC-AUTH-01 (F-001, SR-002) PUT /api/auth/tutor-profile (F-004, TC-PROF-01) requires JWT authentication | Pass |
| 9 | Auth Login and Authorization - TC-AUTH-03 (F-003, SR-003) logs in with valid credentials and returns a JWT without exposing the password hash | Pass |
| 10 | Auth Login and Authorization - TC-AUTH-03 (F-003, SR-003) rejects invalid login credentials with a generic 401 response | Pass |
| 11 | Auth Login and Authorization - TC-AUTH-03 (F-003, SR-003) allows a valid JWT to access the protected current-user endpoint | Pass |
| 12 | Auth Login and Authorization - TC-AUTH-03 (F-003, SR-003) rejects requests without a JWT | Pass |
| 13 | Email Verification - TC-AUTH-02 (F-002) verifies an account with a valid, unexpired token and consumes the token | Pass |
| 14 | Email Verification - TC-AUTH-02 (F-002) rejects an expired verification token | Pass |

### 4.2 `backend/tests/booking-verification.test.js`

| # | Test | Result |
|---|---|---|
| 1 | Booking email verification guard - TC-AUTH-02 rejects unverified learners before reading the slot | Pass |

### 4.3 `backend/tests/bookingNotifications.test.js`

| # | Test | Result |
|---|---|---|
| 1 | booking routes and notifications TC-NOTIF-01: a new booking queues the confirmation and both reminders | Pass |
| 2 | booking routes and notifications queues nothing when the booking is rejected | Pass |
| 3 | booking routes and notifications TC-NOTIF-03: cancelling a booking removes its reminders | Pass |
| 4 | booking routes and notifications keeps the reminders when the cancel is refused | Pass |

### 4.4 `backend/tests/bookings.test.js`

| # | Test | Result |
|---|---|---|
| 1 | POST /api/bookings TC-BOOK-01: booking a free slot returns 201 and the slot becomes BOOKED | Pass |
| 2 | POST /api/bookings TC-BOOK-07: a tutor booking their own slot returns 403 OWN_SLOT | Pass |
| 3 | POST /api/bookings returns 404 for an unknown slot | Pass |
| 4 | POST /api/bookings returns 400 for invalid input | Pass |
| 5 | POST /api/bookings returns 400 for a slot in the past | Pass |
| 6 | POST /api/bookings returns 409 SLOT_TAKEN when the slot is already booked | Pass |
| 7 | POST /api/bookings returns 401 without a token | Pass |
| 8 | POST /api/bookings returns 401 for an invalid token and ignores the old x-user-id header | Pass |
| 9 | POST /api/bookings lets a tutor book another tutor's slot | Pass |
| 10 | POST /api/bookings concurrency and overlap TC-BOOK-02: 10 simultaneous requests for one slot give exactly one 201 and nine 409 SLOT_TAKEN | Pass |
| 11 | POST /api/bookings concurrency and overlap TC-BOOK-03: same learner, overlapping slots from different tutors gives 409 LEARNER_OVERLAP | Pass |
| 12 | POST /api/bookings concurrency and overlap allows back-to-back slots (one ends exactly when the next starts) | Pass |
| 13 | POST /api/bookings concurrency and overlap ignores cancelled bookings when checking overlap | Pass |
| 14 | POST /api/bookings concurrency and overlap one learner firing two overlapping requests at once gets one 201 and one LEARNER_OVERLAP | Pass |
| 15 | POST /api/bookings concurrency and overlap database rejects a second CONFIRMED booking for the same slot (unique index backstop) | Pass |
| 16 | DELETE /api/bookings/:id TC-BOOK-05: cancelling 3 h before start succeeds and frees the slot | Pass |
| 17 | DELETE /api/bookings/:id TC-BOOK-05: cancelling 1 h before start returns 409 TOO_LATE_TO_CANCEL | Pass |
| 18 | DELETE /api/bookings/:id TC-BOOK-05: another learner cancelling returns 403 | Pass |
| 19 | DELETE /api/bookings/:id returns 404 for an unknown booking and 400 for a malformed id | Pass |
| 20 | DELETE /api/bookings/:id returns 409 ALREADY_CANCELLED when cancelling twice | Pass |
| 21 | DELETE /api/bookings/:id returns 401 without a token | Pass |
| 22 | GET /api/bookings/me returns only my bookings, upcoming first | Pass |
| 23 | GET /api/bookings/me returns 401 without a token | Pass |
| 24 | TC-BOOK-04: alternatives on a booking conflict (F-015) returns up to 3 nearest free future slots of the same subject, none of them taken | Pass |
| 25 | TC-BOOK-04: alternatives on a booking conflict (F-015) returns fewer than 3 when fewer exist, and an empty list when none exist | Pass |
| 26 | TC-BOOK-04: alternatives on a booking conflict (F-015) puts the same tutor's slots first, even when another tutor's slot is nearer | Pass |
| 27 | TC-BOOK-04: alternatives on a booking conflict (F-015) never suggests the learner's own slots or slots overlapping their confirmed bookings | Pass |
| 28 | TC-BOOK-04: alternatives on a booking conflict (F-015) also returns alternatives with LEARNER_OVERLAP | Pass |
| 29 | TC-BOOK-04: alternatives on a booking conflict (F-015) does not add alternatives to a successful booking or to other errors | Pass |
| 30 | PATCH /api/bookings/:id (reschedule) TC-BOOK-06: moves the booking to the new slot and frees the old one | Pass |
| 31 | PATCH /api/bookings/:id (reschedule) keeps the note of the original booking | Pass |
| 32 | PATCH /api/bookings/:id (reschedule) TC-BOOK-06: a failed reschedule (new slot taken) leaves the original booking intact | Pass |
| 33 | PATCH /api/bookings/:id (reschedule) TC-BOOK-06: a failed reschedule (overlap with another booking) leaves everything intact | Pass |
| 34 | PATCH /api/bookings/:id (reschedule) does not treat the booking being moved as a clash with itself | Pass |
| 35 | PATCH /api/bookings/:id (reschedule) rejects the new slot with the same rules as booking, changing nothing | Pass |
| 36 | PATCH /api/bookings/:id (reschedule) returns 404 for an unknown new slot or booking, and 400 for the same slot or bad input | Pass |
| 37 | PATCH /api/bookings/:id (reschedule) returns 403 when another learner tries to reschedule | Pass |
| 38 | PATCH /api/bookings/:id (reschedule) applies the cancellation window: 409 TOO_LATE_TO_CANCEL less than 2 h before the old slot | Pass |
| 39 | PATCH /api/bookings/:id (reschedule) returns 409 ALREADY_CANCELLED for a cancelled booking and 401 without a token | Pass |
| 40 | PATCH /api/bookings/:id (reschedule) TC-BOOK-06: two simultaneous reschedules into one slot give exactly one success | Pass |
| 41 | PATCH /api/bookings/:id (reschedule) one booking rescheduled twice at once ends with a single confirmed booking | Pass |

### 4.5 `backend/tests/emailRetry.redis.test.js`

| # | Test | Result |
|---|---|---|
| 1 | TC-NOTIF-04: a mailer that always fails gets 3 retries, then a FAILED log | Pass |
| 2 | a mailer that fails once then works is logged RETRYING, then SENT | Pass |

### 4.6 `backend/tests/emailRetry.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PTS-33 email failure log logs RETRYING while retries remain | Pass |
| 2 | PTS-33 email failure log TC-NOTIF-04: logs FAILED once the last attempt has failed | Pass |

### 4.7 `backend/tests/health.test.js`

| # | Test | Result |
|---|---|---|
| 1 | GET /api/health returns ok | Pass |

### 4.8 `backend/tests/my-bookings.test.js`

| # | Test | Result |
|---|---|---|
| 1 | GET /api/bookings/me - TC-CAL-03 (F-011) returns the authenticated learner's confirmed bookings in calendar-ready form | Pass |
| 2 | GET /api/bookings/me - TC-CAL-03 (F-011) requires a JWT | Pass |

### 4.9 `backend/tests/notification.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PTS-31 confirmation email enqueues one confirmation job per booking | Pass |
| 2 | PTS-31 confirmation email does not throw when the queue is down | Pass |
| 3 | PTS-31 confirmation email TC-NOTIF-01: sends one email to the learner and the tutor, and logs it | Pass |
| 4 | PTS-31 confirmation email sends nothing for a cancelled booking | Pass |

### 4.10 `backend/tests/rate-limit.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PTS-36 rate limiting (TC-SEC-04) returns 429 on the sixth failed login within the window | Pass |
| 2 | PTS-36 rate limiting (TC-SEC-04) returns 429 after twenty-one booking attempts by one learner | Pass |

### 4.11 `backend/tests/reminders.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PTS-32 reminders TC-NOTIF-02: a slot 2 days ahead gets two delayed jobs, at T-24h and T-1h | Pass |
| 2 | PTS-32 reminders skips a reminder whose time has already passed | Pass |
| 3 | PTS-32 reminders schedules nothing for a slot starting in 30 minutes | Pass |
| 4 | PTS-32 reminders does not throw when the queue is down | Pass |
| 5 | PTS-32 reminders TC-NOTIF-03: cancelling removes both pending reminders | Pass |
| 6 | PTS-32 reminders TC-NOTIF-03: sends no reminder if the booking was cancelled before the job ran | Pass |

### 4.12 `backend/tests/rescheduleNotifications.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PATCH /api/bookings/:id and notifications TC-BOOK-06: rescheduling skips the old reminders and confirms the new booking | Pass |
| 2 | PATCH /api/bookings/:id and notifications queues and cancels nothing when the reschedule is rejected | Pass |
| 3 | PATCH /api/bookings/:id and notifications rejects a body without newSlotId | Pass |

### 4.13 `backend/tests/slots.test.js`

| # | Test | Result |
|---|---|---|
| 1 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: repeatWeeks=4 creates exactly 4 slots, each 7 days after the previous, same subject/mode, response count 4 | Pass |
| 2 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: repeatWeeks=8 creates 8 | Pass |
| 3 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: repeatWeeks=9, 0, -1, 2.5 -> 400 INVALID_INPUT | Pass |
| 4 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: repeatWeeks omitted still returns 201 with a single slot DTO (no regression) | Pass |
| 5 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: one instance overlaps an existing slot (e.g. week 3) -> 409 SLOT_OVERLAP, details list that start time, and NO slots from the series were created | Pass |
| 6 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: recurring slots with back-to-back times are allowed | Pass |
| 7 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: learner role -> 403, no token -> 401 | Pass |
| 8 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: single slot overlap throws 409 SLOT_OVERLAP | Pass |
| 9 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: end time before start time returns 400 INVALID_TIME_RANGE | Pass |
| 10 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: start time in past returns 400 SLOT_IN_PAST | Pass |
| 11 | POST /api/slots - Weekly recurring slots (TC-SLOT-02) TC-SLOT-02: findOverlappingSlot helper correctly excludes a slot by ID (reusable for edit) | Pass |
| 12 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: delete a booked slot -> 204, booking CANCELLED, slot not listed, enqueueSlotCancelled called once per learner | Pass |
| 13 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: edit own free slot succeeds; edit that overlaps another slot of the tutor -> 409 SLOT_OVERLAP; edit to its own time succeeds | Pass |
| 14 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: edit a BOOKED slot -> 409 SLOT_BOOKED; delete a FREE slot -> 204 | Pass |
| 15 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: another tutor edits or deletes -> 403 FORBIDDEN; learner role -> 403; no token -> 401; unknown id -> 404 SLOT_NOT_FOUND; bad uuid -> 400 | Pass |
| 16 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: end <= start -> 400 INVALID_TIME_RANGE; past start -> 400 SLOT_IN_PAST | Pass |
| 17 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: a deleted slot no longer blocks creating a slot at the same time, and cannot be booked | Pass |
| 18 | PUT & DELETE /api/slots/:id - Edit or delete a slot (TC-SLOT-04) TC-SLOT-04: worker: SLOT_CANCELLED is sent for a CANCELLED booking; CONFIRMATION is still skipped for a CANCELLED booking | Pass |

### 4.14 `backend/tests/validation.test.js`

| # | Test | Result |
|---|---|---|
| 1 | PTS-36 input validation (TC-SEC-05) rejects unexpected registration fields | Pass |
| 2 | PTS-36 input validation (TC-SEC-05) rejects unexpected booking fields before database access | Pass |
| 3 | PTS-36 input validation (TC-SEC-05) rejects unexpected slot fields before slot creation | Pass |

### 4.15 `backend/tests/verificationEmail.test.js`

| # | Test | Result |
|---|---|---|
| 1 | verification email (SRS F-002, TC-AUTH-02) registration emails a link whose token matches the stored hash | Pass |
| 2 | verification email (SRS F-002, TC-AUTH-02) registration still succeeds when the mail server is down | Pass |
| 3 | verification email (SRS F-002, TC-AUTH-02) escapes the name so it cannot inject HTML | Pass |

## 5. Failures

There were no failures in this run: 0 failed tests, 0 failed suites, 0 skipped tests.

## 6. Notes on what these tests are

- Only `bookings.test.js` and `slots.test.js` (59 of the 106 tests) are database integration tests: they call the Express app through Supertest and create, read and delete real rows in PostgreSQL. The booking concurrency tests (10 simultaneous requests for one slot, simultaneous reschedules) are in this group, so the row locks and the unique index are really tested.
- The other suites mock Prisma and test one unit with the database replaced (`auth`, `my-bookings`, `booking-verification`, `verificationEmail`, `notification`, `reminders`, `bookingNotifications`, `rescheduleNotifications`, `emailRetry`, `emailRetry.redis`). The `health`, `validation` and `rate-limit` tests create no data.
- Email sending uses a mocked mailer. `emailRetry.redis.test.js` uses the real queue and worker against Redis (with Prisma mocked); if Redis is not running that one suite fails.
- The database tests create their own users and slots with unique names and delete them afterwards, so they do not wipe the seed data.
- This report covers the Jest suite in `backend/tests` only. The Playwright end-to-end tests (`e2e/`), the k6 performance script (`perf/`) and the staging smoke script (`scripts/smoke.sh`) were not run for this report.
- Code coverage was not collected in this run. To collect it, run `npx jest --coverage` from `backend`.

## 7. How to reproduce

```
docker compose up -d db          # PostgreSQL 16 (Redis must also be running on port 6379)
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npx jest --json --outputFile=../docs/unit-test-results.json
```

The file paths inside `unit-test-results.json` were shortened to repo-relative paths (the local home directory was removed). Nothing else in the file was changed.

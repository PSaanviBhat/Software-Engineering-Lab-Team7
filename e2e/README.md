# End-to-End (E2E) & Accessibility Test Suite

Playwright test suite covering functional user flows and axe-core accessibility checks for the Peer-to-Peer Tutoring Scheduler.

## Test Coverage

| Test ID | Test File | Description |
|---------|-----------|-------------|
| `TC-AUTH-01` | `tests/auth.spec.js` | User registration succeeds with unique email; duplicate email rejected with 409 |
| `TC-AUTH-03` | `tests/auth.spec.js` | Login with invalid password fails, displays error message, stores no token |
| `TC-CAL-02` | `tests/calendar.spec.js` | Calendar subject filter (e.g. DBMS) filters slots |
| `TC-BOOK-01` | `tests/booking.spec.js` | Learner books free slot, appears in My Bookings, slot status updates to BOOKED |
| `TC-BOOK-05` | `tests/booking.spec.js` | Learner cancels booking >2 hours away; booking removed, slot returns to FREE |
| `TC-SLOT-02` | `tests/slots.spec.js` | Tutor creates weekly recurring slots (repeat 4 weeks); 4 slots created |
| `TC-SLOT-04` | `tests/slots.spec.js` | Tutor edits unbooked slot and deletes slot on `/my-slots` |
| `TC-UX-01` | `tests/a11y.spec.js` | WCAG 2.1 AA automated axe scan (8 pages @ 1280px & 360px) + keyboard-only booking flow |
| `TC-UX-02` | `tests/calendar.spec.js` | 3-click booking flow from calendar |

## Prerequisites

1. PostgreSQL (port 5432) and Redis (port 6379) running.
2. Database migrated and seeded:
   ```bash
   cd backend && npx prisma migrate dev && npx prisma db seed
   ```
3. Backend running on `http://localhost:4000`:
   ```bash
   cd backend && npm run dev
   ```
4. Frontend running on `http://localhost:3000`:
   ```bash
   cd frontend && npm run dev
   ```

## Setup

Install E2E dependencies and Playwright browser binaries:

```bash
cd e2e
npm install
npx playwright install chromium --with-deps
```

## Running Tests

### Run All Tests (Headless)
```bash
cd e2e
npx playwright test
```

### Run Tests in Headful Mode (Visible Browser UI)
```bash
npx playwright test --headed
```

### Run a Specific Test File
```bash
npx playwright test tests/booking.spec.js
npx playwright test tests/calendar.spec.js
npx playwright test tests/a11y.spec.js
```

### Run a Specific Test Case by Name / Title
```bash
npx playwright test -g "TC-BOOK-01"
npx playwright test -g "TC-UX-01"
```

### Run in Debug Mode (Playwright Inspector)
Step through tests interactively with the Playwright Inspector:
```bash
npx playwright test --debug
```

### Run UI Mode
Interactive visual UI with timeline, locator picker, and DOM inspection:
```bash
npx playwright test --ui
```

### Run on a Specific Device / Project
```bash
# Desktop Chromium (1280x720)
npx playwright test --project=chromium

# Mobile Chrome (360x640)
npx playwright test --project=mobile-chrome
```

## Auth State Management

Authentication is managed globally via `tests/auth.setup.js`:
- During the setup project phase, `tests/auth.setup.js` executes before functional tests.
- It verifies existing cached tokens against `GET /api/auth/me`. If invalid or missing, it logs in via `POST /api/auth/login` and persists browser `localStorage` to `.auth/learner.json`, `.auth/tutor.json`, and `.auth/learner-1..15.json`.
- Functional tests load the appropriate authenticated state via `test.use({ storageState: ... })`.

To force refresh of cached auth states:
```bash
rm -rf e2e/.auth
npx playwright test --project=setup
```

## Accessibility Reports

Automated accessibility scans using `@axe-core/playwright` run across 8 application pages (`/`, `/login`, `/register`, `/calendar`, `/my-bookings`, `/tutor-profile`, `/my-slots`, `/verify-email`) at 1280px and 360px viewport widths against WCAG 2.1 AA rules (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).

Scan results are written to `e2e/reports/axe-results.json`.
HTML test report can be viewed with:
```bash
npx playwright show-report
```

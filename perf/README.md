# Performance & Load Testing Suite (k6)

Performance test suite for the Peer-to-Peer Tutoring Scheduler evaluating system throughput, latency, and resilience under realistic concurrent user workloads (STP test case `TC-PERF-01`, SRS non-functional requirement `P2P-NF-001`).

## Test Profile & Workload Mix

- **Target Workload**: Up to 100 Virtual Users (VUs) ramping over 5 minutes:
  - 30s ramp-up to 100 VUs
  - 4 minutes sustained load at 100 VUs
  - 30s ramp-down to 0 VUs
- **Realistic Request Distribution**:
  - `70%` `GET /api/slots` (browsing calendar with randomized subject & date range filters)
  - `15%` `GET /api/slots/tutors` (populating tutor filter dropdowns)
  - `10%` `GET /api/bookings/me` (retrieving current learner bookings)
  - `5%` `POST /api/bookings` (attempting slot reservations on available slots)
- **Expected Responses**:
  - `200` OK / `201` Created
  - `409` Conflict (`SLOT_TAKEN` / `LEARNER_OVERLAP`): Expected business logic responses under concurrent booking contention.
  - `429` Too Many Requests (`RATE_LIMITED`): Returned when requests exceed per-user rate limits (e.g. 20 bookings/hour per learner).

## SLA / Threshold Criteria (P2P-NF-001)

- **Latency**: 95th percentile response duration (`p95`) must be strictly **under 500ms** (`http_req_duration: ['p(95)<500']`).
- **Error Rate**: Server error rate (`5xx` or unhandled failures) must be strictly **under 1%** (`http_req_failed: ['rate<0.01']`).

## Prerequisites

1. Install `k6`:
   ```bash
   # macOS via Homebrew
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update && sudo apt-get install k6
   ```

2. Start PostgreSQL, Redis, and the backend application:
   ```bash
   # Backend running on port 4000
   cd backend && npm run dev
   ```

3. Ensure test seed data is present:
   ```bash
   cd backend && npx prisma db seed
   ```

## Running Performance Tests

### Smoke Mode (30 Seconds, 5 VUs)
Used in CI and quick developer validation:
```bash
SMOKE=1 k6 run perf/booking-load.js
```

### Full Load Test (5 Minutes, 100 VUs)
Simulates peak traffic concurrency according to STP TC-PERF-01:
```bash
k6 run perf/booking-load.js
```

### Custom Target API URL
Override default endpoint (`http://localhost:4000/api`):
```bash
BASE_URL="https://staging.tutoring.example.com/api" k6 run perf/booking-load.js
```

## Interpreting Output Reports

Execution automatically writes two summary report artifacts to `perf/reports/`:
- `perf/reports/summary.txt`: Plaintext summary showing total requests, throughput (req/s), error rate, latency percentiles (`p50`, `p90`, `p95`, `p99`), and threshold pass/fail status.
- `perf/reports/summary.json`: Detailed machine-readable JSON containing full metrics telemetry and distribution counters.

Example summary output:
```text
==================================================
       k6 Performance Test Summary (TC-PERF-01)
==================================================
Total Requests:        2267
Requests Per Second:   62.28 req/s
Error Rate:            0.00%
Duration p50:          5.51 ms
Duration p90:          7.08 ms
Duration p95:          7.82 ms
Duration p99:          14.34 ms
--------------------------------------------------
Thresholds:
  http_req_duration (p95 < 500ms):  PASS (7.82 ms)
  http_req_failed (rate < 1%):      PASS (0.00%)
==================================================
```

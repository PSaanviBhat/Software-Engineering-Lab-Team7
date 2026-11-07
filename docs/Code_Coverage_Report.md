# Code Coverage Report (PTS-45)

Peer-to-Peer Tutoring Scheduler backend coverage report.

## Run details

| Item | Value |
|---|---|
| Date | 2026-11-07 |
| Source revision | `fa4da97` (`main`) |
| Command | `cd backend && npm test -- --coverage` |
| Test runner | Jest 30.5.2 |
| Runtime | GitHub Actions, Node.js 20 |
| Services | PostgreSQL 16 and Redis 7 |
| CI run | [GitHub Actions run 42371641464](https://github.com/PSaanviBhat/Software-Engineering-Lab-Team7/actions/runs/42371641464) |

## Results

| Measure | Result |
|---|---:|
| Statement coverage | 89.47% |
| Branch coverage | 77.77% |
| Function coverage | 88.54% |
| Line coverage | 91.21% |

The project target is at least 70% backend unit-test coverage. All four reported measures exceed that target.

## Test execution

| Metric | Result |
|---|---:|
| Test suites | 15 passed / 15 total |
| Tests | 106 passed / 106 total |
| Snapshots | 0 |
| Overall result | PASSED |

Coverage is collected by the existing backend CI job, which provisions PostgreSQL and Redis, applies Prisma migrations, and runs the complete Jest suite. The generated `coverage/` directory remains ignored as a build artifact; this checked-in report preserves the verified summary for PTS-45.


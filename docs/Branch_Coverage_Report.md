# Branch Coverage Report (PTS-46)

Peer-to-Peer Tutoring Scheduler backend branch-coverage report.

## Run details

| Item | Value |
|---|---|
| Date | 2026-11-07 |
| Source revision | `976c607` (`main`) |
| Command | `cd backend && npm test -- --coverage` |
| Test runner | Jest 30.5.2 |
| Runtime | GitHub Actions, Node.js 20 |
| Services | PostgreSQL 16 and Redis 7 |
| CI run | [GitHub Actions run 42371641464](https://github.com/PSaanviBhat/Software-Engineering-Lab-Team7/actions/runs/42371641464) |

## Branch coverage result

| Measure | Result |
|---|---:|
| Branch coverage | 77.77% |

The project target is at least 70% backend test coverage. Branch coverage exceeds that target by 7.77 percentage points.

## Supporting coverage results

| Measure | Result |
|---|---:|
| Statement coverage | 89.47% |
| Function coverage | 88.54% |
| Line coverage | 91.21% |
| Test suites | 15 passed / 15 total |
| Tests | 106 passed / 106 total |

Coverage is collected by the backend CI job, which provisions PostgreSQL and Redis, applies Prisma migrations, and runs the complete Jest suite. The generated `coverage/` directory remains ignored as a build artifact; this checked-in report preserves the verified branch-coverage result for PTS-46.


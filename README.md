# Peer-to-Peer Tutoring Scheduler

A booking system where students offer tutoring slots, and peers browse availability to reserve one-on-one sessions. The project includes calendar UI components, booking conflict resolution, and email reminder automation via background jobs.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [Testing](#testing)
- [API Overview](#api-overview)
- [Development Workflow](#development-workflow)
- [Documentation](#documentation)
- [Team](#team)

## Features

- Registration, email verification and JWT-based login with role-based access (Learner, Tutor, Admin)
- Tutor profiles with subjects and a short bio
- Publish single or weekly recurring availability slots, with overlap prevention
- Calendar UI with month, week and day views, plus filters by subject, tutor, date range and mode
- Booking with conflict resolution: a slot can be booked by only one learner, even under concurrent requests
- Learner overlap detection, with up to three alternative slot suggestions on conflict
- Cancel and reschedule bookings within the allowed window
- Booking confirmation, 24-hour and 1-hour reminder emails sent by background jobs, with retries and logging
- Ratings and reviews after completed sessions
- Basic admin moderation (suspend users, hide abusive reviews)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React, App Router), FullCalendar, Tailwind CSS, Axios |
| Backend | Node.js 20, Express, Prisma ORM, Zod, JWT |
| Database | PostgreSQL 16 |
| Background jobs | Redis 7, BullMQ, Nodemailer (SendGrid or Mailtrap sandbox) |
| Testing | Jest, Supertest, React Testing Library, Playwright, k6 |
| DevOps | Docker, Docker Compose, GitHub Actions |
| Project tracking | Jira |

## Architecture

The system is a layered (n-tier) modular monolith:

1. **Presentation layer:** Next.js web app with the calendar UI.
2. **Application layer:** Express REST API with JWT authentication, role-based access control and validation. Business logic lives in separate services: Auth, Slot, Booking, Notification and Review.
3. **Background processing:** Notification Service enqueues jobs into a Redis-backed BullMQ queue. A Reminder Worker processes delayed jobs and sends email, retrying failures with exponential backoff.
4. **Data layer:** PostgreSQL accessed through Prisma.

Double booking is prevented with three combined mechanisms: a unique constraint on active bookings per slot, a row lock (`SELECT ... FOR UPDATE`) inside a transaction, and an overlap query on the learner's existing bookings. Losers of a race receive `409 Conflict` along with alternative slots.

All times are stored in UTC and converted to the user's local time zone for display.

## Repository Structure

```
.
├── backend/             Express API, Prisma schema, background worker, tests
│   ├── prisma/          Schema, migrations and seed script
│   ├── src/
│   │   ├── routes/      Express routers
│   │   ├── services/    Business logic
│   │   ├── middleware/  Auth, RBAC, validation, error handling
│   │   └── lib/         Shared helpers (Prisma client, etc.)
│   └── tests/           Unit and integration tests
├── frontend/            Next.js application
├── docs/                SRS, SAD and STP documents
├── videos/              Sprint demo videos
├── .github/workflows/   CI pipeline
└── docker-compose.yml   Runs the app, PostgreSQL and Redis together
```

## Getting Started

### Prerequisites

- Git
- Node.js 20
- Docker Desktop (for PostgreSQL and Redis, or to run the full stack)

### 1. Clone the repository

```bash
git clone https://github.com/PSaanviBhat/Software-Engineering-Lab-Team7.git
cd Software-Engineering-Lab-Team7
```

### 2. Start PostgreSQL and Redis

```bash
docker run --name pts-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tutoring -p 5432:5432 -d postgres:16
docker run --name pts-redis -p 6379:6379 -d redis:7
```

### 3. Set up the backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed      # optional: loads sample users and slots
npm run dev
```

The API runs on http://localhost:4000. Check http://localhost:4000/api/health to confirm it is up.

### 4. Set up the frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The web app runs on http://localhost:3000.

On Windows PowerShell, use `copy` instead of `cp`.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`, then fill in the values. Never commit real secrets or `.env` files.

## Running with Docker

To run the whole system with one command:

```bash
docker compose up --build
```

This starts the frontend, backend, PostgreSQL and Redis. Database migrations are applied automatically when the backend container starts.

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/health

Stop everything with `docker compose down`.

## Testing

Backend:

```bash
cd backend
npm run lint
npm test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Continuous integration runs lint, tests and build on every pull request. The project targets at least 70 percent backend unit-test coverage. Planned test levels are unit (Jest), integration (Supertest with PostgreSQL and Redis), end-to-end (Playwright), performance (k6) and security (OWASP ZAP baseline scan).

## API Overview

| Method | Endpoint | Description | Role |
|---|---|---|---|
| POST | `/api/auth/register` | Create an account | Public |
| POST | `/api/auth/login` | Log in, returns token and user | Public |
| GET | `/api/slots` | Browse and filter slots | Authenticated |
| POST | `/api/slots` | Create a slot (optionally recurring) | Tutor |
| PUT / DELETE | `/api/slots/{id}` | Edit or delete a slot | Tutor |
| POST | `/api/bookings` | Book a slot | Learner |
| GET | `/api/bookings/me` | List my bookings | Authenticated |
| PATCH | `/api/bookings/{id}` | Reschedule a booking | Learner |
| DELETE | `/api/bookings/{id}` | Cancel a booking | Learner |
| GET | `/api/health` | Health check | Public |

Errors use a uniform body: `{ "error": "CODE", "message": "text", "details": {} }`. Booking conflicts return `409` with `SLOT_TAKEN` or `LEARNER_OVERLAP` and a list of alternative slots.

## Development Workflow

- Tasks are tracked in Jira (project key `PTS`).
- Never push directly to `main`. All changes go through a pull request.
- Branch names start with the Jira key, for example `PTS-9-project-structure`.
- Commit messages and pull request titles start with the Jira key, for example `PTS-9 Set up project structure`.
- Every pull request needs one approval and a passing CI run before merging.
- Never commit passwords, keys or `.env` files.

## Documentation

Project documents are in the `docs/` folder:

- Software Requirements Specification (SRS)
- Software Architecture and Design Specification (SAD)
- Software Test Plan (STP)

## Team

| Name | Role |
|---|---|
| Sonia Sharma | QA Lead, Jira owner, booking features |
| P Saanvi | Test Engineer, repository owner, project setup and CI |
| Kasissnu Ssinha | Developer, authentication and tutor profiles |
| Kaustubh Akash | Product Owner and Reviewer, slots and calendar UI |
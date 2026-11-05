const { test: setup, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const authDir = path.join(__dirname, '..', '.auth');
const learnerAuthFile = path.join(authDir, 'learner.json');
const tutorAuthFile = path.join(authDir, 'tutor.json');

setup('authenticate as learner and tutor', async ({ request }) => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // If already logged in and tokens are valid, reuse them (tokens valid for 7 days)
  if (fs.existsSync(learnerAuthFile) && fs.existsSync(tutorAuthFile) && fs.existsSync(path.join(authDir, 'learner-15.json'))) {
    try {
      const state = JSON.parse(fs.readFileSync(learnerAuthFile, 'utf8'));
      const token = state.origins[0].localStorage.find((x) => x.name === 'token')?.value;
      const testRes = await request.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (testRes.ok()) {
        return; // Valid tokens already cached
      }
    } catch {
      // Refresh tokens
    }
  }

  // 1. Learner 1..15 login to allow per-worker isolated learners
  for (let i = 1; i <= 15; i++) {
    const learnerRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: `learner${i}@example.com`,
        password: 'Password@123',
      },
    });
    expect(learnerRes.ok(), `Learner ${i} login failed: ${await learnerRes.text()}`).toBeTruthy();
    const learnerData = await learnerRes.json();

    const state = {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'token', value: learnerData.token },
            { name: 'user', value: JSON.stringify(learnerData.user) },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(authDir, `learner-${i}.json`), JSON.stringify(state, null, 2));
    if (i === 1) {
      fs.writeFileSync(learnerAuthFile, JSON.stringify(state, null, 2));
    }
  }

  // 2. Tutor login
  const tutorRes = await request.post(`${API_URL}/auth/login`, {
    data: {
      email: 'tutor1@example.com',
      password: 'Password@123',
    },
  });
  expect(tutorRes.ok(), `Tutor login failed: ${await tutorRes.text()}`).toBeTruthy();
  const tutorData = await tutorRes.json();

  const tutorState = {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: 'token', value: tutorData.token },
          { name: 'user', value: JSON.stringify(tutorData.user) },
        ],
      },
    ],
  };
  fs.writeFileSync(tutorAuthFile, JSON.stringify(tutorState, null, 2));
});

import http from 'k6/http';
import { sleep } from 'k6';

const isSmoke = __ENV.SMOKE === '1';
const baseUrl = __ENV.BASE_URL || 'http://localhost:4000/api';

export const options = {
  stages: isSmoke
    ? [
        { duration: '5s', target: 5 },
        { duration: '20s', target: 5 },
        { duration: '5s', target: 0 },
      ]
    : [
        { duration: '30s', target: 100 },
        { duration: '4m', target: 100 },
        { duration: '30s', target: 0 },
      ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// 409 (SLOT_TAKEN / LEARNER_OVERLAP) and 429 (RATE_LIMITED) are expected business responses under high concurrency and must not count as server failures
http.setResponseCallback(http.expectedStatuses(200, 201, 409, 429));

export function setup() {
  const tokens = [];
  // Seeded learners: learner1..15@example.com, password Password@123
  for (let i = 1; i <= 15; i++) {
    const res = http.post(
      `${baseUrl}/auth/login`,
      JSON.stringify({
        email: `learner${i}@example.com`,
        password: 'Password@123',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (res.status === 200) {
      try {
        const json = JSON.parse(res.body);
        if (json.token) tokens.push(json.token);
      } catch (e) {
        console.error(`Failed to parse login response for learner${i}: ${res.body}`);
      }
    } else {
      console.error(`Login failed for learner${i}: status ${res.status}`);
    }
  }

  // Pre-fetch slots for booking requests
  let slotIds = [];
  if (tokens.length > 0) {
    const slotsRes = http.get(`${baseUrl}/slots`, {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    if (slotsRes.status === 200) {
      try {
        const slots = JSON.parse(slotsRes.body);
        slotIds = slots.map((s) => s.id);
      } catch (e) {
        console.error('Failed to parse slots response in setup:', e);
      }
    }
  }

  return { tokens, slotIds, baseUrl };
}

export default function (data) {
  if (!data.tokens || data.tokens.length === 0) {
    return;
  }

  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const urlBase = data.baseUrl || baseUrl;
  const rand = Math.random();

  if (rand < 0.70) {
    // 70% GET /api/slots with random subject and date filters
    const subjects = ['DBMS', 'OS', 'DSA', 'Maths', 'Networks', ''];
    const subj = subjects[Math.floor(Math.random() * subjects.length)];
    const params = [];
    if (subj) params.push(`subject=${encodeURIComponent(subj)}`);

    const dayOffset = Math.floor(Math.random() * 12) + 1;
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() + dayOffset);
    params.push(`from=${encodeURIComponent(fromDate.toISOString())}`);

    const url = `${urlBase}/slots${params.length > 0 ? '?' + params.join('&') : ''}`;
    http.get(url, { headers: { Authorization: `Bearer ${token}` } });
  } else if (rand < 0.85) {
    // 15% GET /api/slots/tutors
    http.get(`${urlBase}/slots/tutors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } else if (rand < 0.95) {
    // 10% GET /api/bookings/me
    http.get(`${urlBase}/bookings/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } else {
    // 5% POST /api/bookings on a random FREE slot
    if (data.slotIds && data.slotIds.length > 0) {
      const slotId = data.slotIds[Math.floor(Math.random() * data.slotIds.length)];
      http.post(
        `${urlBase}/bookings`,
        JSON.stringify({ slotId }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }
  }

  sleep(0.05);
}

export function handleSummary(data) {
  const dur = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values : {};

  const p50 = dur['p(50)'] !== undefined ? dur['p(50)'].toFixed(2) : 'N/A';
  const p90 = dur['p(90)'] !== undefined ? dur['p(90)'].toFixed(2) : 'N/A';
  const p95 = dur['p(95)'] !== undefined ? dur['p(95)'].toFixed(2) : 'N/A';
  const p99 = dur['p(99)'] !== undefined ? dur['p(99)'].toFixed(2) : 'N/A';

  const rps = reqs.rate !== undefined ? reqs.rate.toFixed(2) : 'N/A';
  const totalReqs = reqs.count !== undefined ? reqs.count : 'N/A';
  const errorRate = failed.rate !== undefined ? (failed.rate * 100).toFixed(2) + '%' : 'N/A';

  const durPass = dur['p(95)'] !== undefined && dur['p(95)'] < 500;
  const failedPass = failed.rate !== undefined && failed.rate < 0.01;

  const summaryText = [
    '==================================================',
    '       k6 Performance Test Summary (TC-PERF-01)',
    '==================================================',
    `Total Requests:        ${totalReqs}`,
    `Requests Per Second:   ${rps} req/s`,
    `Error Rate:            ${errorRate}`,
    `Duration p50:          ${p50} ms`,
    `Duration p90:          ${p90} ms`,
    `Duration p95:          ${p95} ms`,
    `Duration p99:          ${p99} ms`,
    '--------------------------------------------------',
    'Thresholds:',
    `  http_req_duration (p95 < 500ms):  ${durPass ? 'PASS' : 'FAIL'} (${p95} ms)`,
    `  http_req_failed (rate < 1%):      ${failedPass ? 'PASS' : 'FAIL'} (${errorRate})`,
    '==================================================',
  ].join('\n');

  return {
    'perf/reports/summary.json': JSON.stringify(data, null, 2),
    'perf/reports/summary.txt': summaryText,
    stdout: summaryText + '\n',
  };
}

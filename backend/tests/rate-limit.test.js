const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { bookingLimiter, loginLimiter } = require("../src/middleware/rateLimit");

describe("PTS-36 rate limiting (TC-SEC-04)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-only-jwt-secret";
    process.env.RATE_LIMIT_STORE = "memory";
  });

  beforeEach(() => {
    loginLimiter.clearMemory();
    bookingLimiter.clearMemory();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_STORE;
  });

  it("returns 429 on the sixth failed login within the window", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await request(app).post("/api/auth/login").send({ email: "bad" }));
    }

    expect(responses.slice(0, 5).every((response) => response.status === 400)).toBe(true);
    expect(responses[5].status).toBe(429);
    expect(responses[5].body.error).toBe("RATE_LIMITED");
    expect(responses[5].headers["retry-after"]).toBeDefined();
  });

  it("returns 429 after twenty-one booking attempts by one learner", async () => {
    const token = jwt.sign(
      { id: "learner-rate-limit", email: "learner@example.edu", role: "LEARNER" },
      process.env.JWT_SECRET
    );
    const responses = [];
    for (let attempt = 0; attempt < 21; attempt += 1) {
      responses.push(
        await request(app)
          .post("/api/bookings")
          .set("Authorization", `Bearer ${token}`)
          .send({ slotId: "not-a-uuid" })
      );
    }

    expect(responses.slice(0, 20).every((response) => response.status === 400)).toBe(true);
    expect(responses[20].status).toBe(429);
    expect(responses[20].body.error).toBe("RATE_LIMITED");
  });
});

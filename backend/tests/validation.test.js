const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");

describe("PTS-36 input validation (TC-SEC-05)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-only-jwt-secret";
  });

  it("rejects unexpected registration fields", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Test Learner",
      email: "learner@example.edu",
      password: "StrongPassword123!",
      role: "ADMIN",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });

  it("rejects unexpected booking fields before database access", async () => {
    const token = jwt.sign(
      { id: "learner-validation", email: "learner@example.edu", role: "LEARNER" },
      process.env.JWT_SECRET
    );
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ slotId: "00000000-0000-4000-8000-000000000000", admin: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });

  it("rejects unexpected slot fields before slot creation", async () => {
    const token = jwt.sign(
      { id: "tutor-validation", email: "tutor@example.edu", role: "TUTOR" },
      process.env.JWT_SECRET
    );
    const response = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "DBMS",
        start: "2026-11-10T10:00:00.000Z",
        end: "2026-11-10T11:00:00.000Z",
        mode: "ONLINE",
        isAdmin: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_INPUT");
  });
});

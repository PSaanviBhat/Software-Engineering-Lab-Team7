const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

jest.mock("../src/lib/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

describe("Auth Registration - TC-AUTH-01 (F-001, SR-002)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("successfully registers a new user and returns 201 with token and safe user profile", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: "user-uuid-1",
      name: data.name,
      email: data.email,
      role: data.role,
      verified: data.verified,
      suspended: false,
      subjects: data.subjects,
      bio: null,
    }));

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Kasissnu Ssinha",
        email: "kasissnu@example.edu",
        password: "StrongPassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.name).toBe("Kasissnu Ssinha");
    expect(res.body.user.email).toBe("kasissnu@example.edu");
    expect(res.body.user.role).toBe("LEARNER");
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("passwordHash");

    // Verify bcrypt cost factor is 12 (SR-002)
    const createCall = prisma.user.create.mock.calls[0][0];
    const storedHash = createCall.data.passwordHash;
    expect(storedHash.startsWith("$2a$12$") || storedHash.startsWith("$2b$12$")).toBe(true);
    const passwordMatches = await bcrypt.compare("StrongPassword123!", storedHash);
    expect(passwordMatches).toBe(true);
  });

  it("rejects registration with duplicate email and returns 409 Conflict", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "existing-uuid",
      email: "duplicate@example.edu",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate User",
        email: "duplicate@example.edu",
        password: "StrongPassword123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("EMAIL_EXISTS");
    expect(res.body.message).toMatch(/already registered/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing or empty", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "",
        email: "student@example.edu",
        password: "StrongPassword123!",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_INPUT");
    expect(res.body.details).toHaveProperty("name");
  });

  it("returns 400 when email format is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Student",
        email: "not-an-email",
        password: "StrongPassword123!",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_INPUT");
    expect(res.body.details).toHaveProperty("email");
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Student",
        email: "student@example.edu",
        password: "short",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_INPUT");
    expect(res.body.details).toHaveProperty("password");
  });
});

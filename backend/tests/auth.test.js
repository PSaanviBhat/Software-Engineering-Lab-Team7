const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { requireRole } = require("../src/middleware/rbac");

jest.mock("../src/lib/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

describe("Authentication & RBAC (F-003, SR-003, TC-AUTH-03, TC-SEC-03, TC-ADM-01)", () => {
  const secret = process.env.JWT_SECRET || "default_jwt_secret";
  let validPasswordHash;

  beforeAll(async () => {
    validPasswordHash = await bcrypt.hash("Password@123", 12);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/login", () => {
    it("TC-AUTH-03: returns 200 and a signed JWT token on valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        name: "Test Learner",
        email: "learner@example.edu",
        passwordHash: validPasswordHash,
        role: "LEARNER",
        verified: true,
        suspended: false,
        subjects: [],
        bio: null,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "learner@example.edu",
          password: "Password@123",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe("learner@example.edu");
      expect(res.body.user.role).toBe("LEARNER");
      expect(res.body.user).not.toHaveProperty("password");
      expect(res.body.user).not.toHaveProperty("passwordHash");

      // Verify token payload
      const decoded = jwt.verify(res.body.token, secret);
      expect(decoded.id).toBe("user-123");
      expect(decoded.role).toBe("LEARNER");
    });

    it("TC-AUTH-03: returns 401 INVALID_CREDENTIALS when password does not match", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        name: "Test Learner",
        email: "learner@example.edu",
        passwordHash: validPasswordHash,
        role: "LEARNER",
        verified: true,
        suspended: false,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "learner@example.edu",
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_CREDENTIALS");
    });

    it("returns 401 INVALID_CREDENTIALS when user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.edu",
          password: "Password@123",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_CREDENTIALS");
    });

    it("TC-ADM-01: returns 403 ACCOUNT_SUSPENDED when user account is suspended", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-suspended",
        name: "Suspended User",
        email: "suspended@example.edu",
        passwordHash: validPasswordHash,
        role: "LEARNER",
        verified: true,
        suspended: true,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "suspended@example.edu",
          password: "Password@123",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("ACCOUNT_SUSPENDED");
    });

    it("returns 400 for invalid email input", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "not-an-email",
          password: "Password@123",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_INPUT");
    });
  });

  describe("Protected Route & Role Checks (SR-003, TC-SEC-03)", () => {
    it("returns 401 when accessing protected route without a token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHORIZED");
    });

    it("returns 401 when accessing protected route with an invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token-xyz");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHORIZED");
    });

    it("returns 200 with user payload when accessing protected route with valid token", async () => {
      const token = jwt.sign(
        { id: "user-999", email: "user@example.edu", role: "TUTOR" },
        secret,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe("user-999");
      expect(res.body.user.role).toBe("TUTOR");
    });

    it("RBAC middleware allows user with matching role and rejects others with 403", () => {
      const middleware = requireRole("TUTOR", "ADMIN");
      const nextFn = jest.fn();

      // Case 1: Permitted role
      const reqPermitted = { user: { id: "1", role: "TUTOR" } };
      const resPermitted = {};
      middleware(reqPermitted, resPermitted, nextFn);
      expect(nextFn).toHaveBeenCalledWith();

      // Case 2: Forbidden role
      nextFn.mockClear();
      const reqForbidden = { user: { id: "2", role: "LEARNER" } };
      const resForbidden = {};
      middleware(reqForbidden, resForbidden, nextFn);
      expect(nextFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          code: "FORBIDDEN",
        })
      );
    });
  });
});

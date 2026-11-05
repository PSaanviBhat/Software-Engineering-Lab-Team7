process.env.ENABLE_QUEUE_IN_TESTS = "true";
process.env.JWT_SECRET = "test-only-jwt-secret";
process.env.FRONTEND_URL = "https://staging.example.com";

jest.mock("../src/lib/mailer", () => ({ sendMail: jest.fn() }));
jest.mock("../src/lib/prisma", () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
}));

const crypto = require("crypto");
const prisma = require("../src/lib/prisma");
const { sendMail } = require("../src/lib/mailer");
const { register } = require("../src/services/authService");
const { sendVerificationEmail } = require("../src/services/notificationService");

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeUser = async ({ data }) => ({
  id: "u1",
  role: "LEARNER",
  verified: false,
  suspended: false,
  subjects: [],
  bio: null,
  ...data,
});

describe("verification email (SRS F-002, TC-AUTH-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("registration emails a link whose token matches the stored hash", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(makeUser);

    await register({ name: "Asha", email: "asha@test.local", password: "Password@123" });
    await flush();

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("asha@test.local");

    const link = mail.html.match(/https:\/\/staging\.example\.com\/verify-email\?token=([0-9a-f]+)/);
    expect(link).not.toBeNull();
    const storedHash = prisma.user.create.mock.calls[0][0].data.verificationTokenHash;
    expect(crypto.createHash("sha256").update(link[1]).digest("hex")).toBe(storedHash);
    // The raw token is never stored.
    expect(JSON.stringify(prisma.user.create.mock.calls[0][0])).not.toContain(link[1]);
  });

  it("registration still succeeds when the mail server is down", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(makeUser);

    const result = await register({ name: "Ravi", email: "ravi@test.local", password: "Password@123" });
    await flush();

    expect(result.token).toEqual(expect.any(String));
  });

  it("escapes the name so it cannot inject HTML", async () => {
    await sendVerificationEmail({ name: "<b>x</b>", email: "x@test.local" }, "abc123");
    expect(sendMail.mock.calls[0][0].html).not.toContain("<b>x</b>");
    expect(sendMail.mock.calls[0][0].html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
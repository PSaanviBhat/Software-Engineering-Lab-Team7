const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Registers a new user.
 * @param {object} input - { name, email, password }
 * @returns {Promise<{ user: object, token: string }>}
 */
async function register(input) {
  const parseResult = registerSchema.safeParse(input);
  if (!parseResult.success) {
    const error = new Error("Validation failed");
    error.status = 400;
    error.code = "INVALID_INPUT";
    error.details = parseResult.error.flatten().fieldErrors;
    throw error;
  }

  const { name, email, password } = parseResult.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error("Email already registered");
    error.status = 409;
    error.code = "EMAIL_EXISTS";
    error.details = { email: ["An account with this email already exists"] };
    throw error;
  }

  // Hash password with cost 12 (OWASP / SRS P2P-SR-002)
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "LEARNER",
      verified: false,
      subjects: [],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      verified: true,
      suspended: true,
      subjects: true,
      bio: true,
    },
  });

  const secret = process.env.JWT_SECRET || "default_jwt_secret";
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" }
  );

  return { user, token };
}

module.exports = {
  registerSchema,
  register,
};

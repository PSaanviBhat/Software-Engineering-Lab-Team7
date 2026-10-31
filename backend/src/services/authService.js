const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
    suspended: user.suspended,
    subjects: user.subjects || [],
    bio: user.bio || null,
  };
}

async function login(input) {
  const parseResult = loginSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid login input");
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.suspended) {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "Your account has been suspended");
  }

  const token = signToken(user);
  return {
    token,
    user: sanitizeUser(user),
  };
}

async function register(input) {
  const parseResult = registerSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AppError(400, "INVALID_INPUT", "Invalid registration input");
  }

  const { name, email, password } = parseResult.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(409, "EMAIL_EXISTS", "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "LEARNER",
      verified: false,
      subjects: [],
    },
  });

  const token = signToken(newUser);
  return {
    token,
    user: sanitizeUser(newUser),
  };
}

module.exports = {
  loginSchema,
  registerSchema,
  login,
  register,
  signToken,
  sanitizeUser,
};

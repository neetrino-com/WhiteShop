import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { db } from "@white-shop/db";

export interface RegisterData {
  email?: string;
  phone?: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginData {
  email?: string;
  phone?: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    roles: string[];
  };
  token: string;
}

class AuthService {
  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    console.log("🔐 [AUTH] Registration attempt:", {
      email: data.email || "not provided",
      phone: data.phone || "not provided",
      hasFirstName: !!data.firstName,
      hasLastName: !!data.lastName,
    });

    if (!data.email && !data.phone) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation failed",
        detail: "Either email or phone is required",
      };
    }

    if (!data.password || data.password.length < 6) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation failed",
        detail: "Password must be at least 6 characters",
      };
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingUser) {
      console.log(
        "❌ [AUTH] User already exists:",
        existingUser.email || existingUser.phone
      );
      throw {
        status: 409,
        type: "https://api.shop.am/problems/conflict",
        title: "User already exists",
        detail: "User with this email or phone already exists",
      };
    }

    // Hash password
    console.log("🔒 [AUTH] Hashing password...");
    const passwordHash = await bcrypt.hash(data.password, 10);
    console.log("✅ [AUTH] Password hashed successfully");

    // Create user
    console.log("💾 [AUTH] Creating user in database...");
    let user;
    try {
      user = await db.user.create({
        data: {
          email: data.email || null,
          phone: data.phone || null,
          passwordHash,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          locale: "en",
          roles: ["customer"],
        },
      });
      console.log("✅ [AUTH] User created successfully");
    } catch (error: any) {
      console.error("❌ [AUTH] User creation failed:", error);
      if (error.code === "P2002") {
        // Prisma unique constraint error
        throw {
          status: 409,
          type: "https://api.shop.am/problems/conflict",
          title: "User already exists",
          detail: "User with this email or phone already exists",
        };
      }
      throw error;
    }

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error("❌ [AUTH] JWT_SECRET is not set!");
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Server configuration error",
      };
    }

    console.log("🎫 [AUTH] Generating JWT token...");
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
    );
    console.log("✅ [AUTH] JWT token generated");

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      token,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    console.log("🔐 [AUTH] Login attempt:", {
      email: data.email || "not provided",
      phone: data.phone || "not provided",
    });

    if (!data.email && !data.phone) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation failed",
        detail: "Either email or phone is required",
      };
    }

    if (!data.password) {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation failed",
        detail: "Password is required",
      };
    }

    // Find user
    console.log("🔍 [AUTH] Searching for user in database...");
    const user = await db.user.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      console.log("❌ [AUTH] User not found or no password set");
      throw {
        status: 401,
        type: "https://api.shop.am/problems/unauthorized",
        title: "Invalid credentials",
        detail: "Invalid email/phone or password",
      };
    }

    console.log("✅ [AUTH] User found:", user.id);

    // Check password
    console.log("🔒 [AUTH] Verifying password...");
    const isValidPassword = await bcrypt.compare(
      data.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      console.log("❌ [AUTH] Invalid password");
      throw {
        status: 401,
        type: "https://api.shop.am/problems/unauthorized",
        title: "Invalid credentials",
        detail: "Invalid email/phone or password",
      };
    }

    if (user.blocked) {
      console.log("❌ [AUTH] Account is blocked");
      throw {
        status: 403,
        type: "https://api.shop.am/problems/forbidden",
        title: "Account blocked",
        detail: "Your account has been blocked",
      };
    }

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Server configuration error",
      };
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
    );

    console.log("✅ [AUTH] Login successful, token generated");

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      token,
    };
  }
}

export const authService = new AuthService();


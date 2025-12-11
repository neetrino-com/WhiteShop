import { db } from "@white-shop/db";
import * as bcrypt from "bcryptjs";

class UsersService {
  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        locale: true,
        addresses: true,
      },
    });

    if (!user) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "User not found",
      };
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      addresses: user.addresses,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: any) {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        locale: data.locale,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        locale: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
    };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // Validate input parameters
    if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.trim() === '') {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "Old password is required and must be a non-empty string",
      };
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim() === '') {
      throw {
        status: 400,
        type: "https://api.shop.am/problems/validation-error",
        title: "Validation Error",
        detail: "New password is required and must be a non-empty string",
      };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw {
        status: 401,
        type: "https://api.shop.am/problems/unauthorized",
        title: "Invalid credentials",
        detail: "User not found or password not set",
      };
    }

    // Validate that passwordHash is a valid string
    if (typeof user.passwordHash !== 'string' || user.passwordHash.trim() === '') {
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "User password hash is invalid",
      };
    }

    try {
      const isValid = await bcrypt.compare(oldPassword.trim(), user.passwordHash);
      if (!isValid) {
        throw {
          status: 401,
          type: "https://api.shop.am/problems/unauthorized",
          title: "Invalid password",
          detail: "The old password is incorrect",
        };
      }
    } catch (bcryptError: any) {
      // Handle bcrypt errors
      console.error("❌ [USERS SERVICE] bcrypt.compare error:", {
        error: bcryptError,
        message: bcryptError?.message,
        userId,
        hasOldPassword: !!oldPassword,
        hasPasswordHash: !!user.passwordHash,
      });
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Failed to verify password",
      };
    }

    try {
      const newPasswordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      return { success: true };
    } catch (hashError: any) {
      console.error("❌ [USERS SERVICE] bcrypt.hash error:", {
        error: hashError,
        message: hashError?.message,
        userId,
      });
      throw {
        status: 500,
        type: "https://api.shop.am/problems/internal-error",
        title: "Internal Server Error",
        detail: "Failed to hash new password",
      };
    }
  }

  /**
   * Get addresses
   */
  async getAddresses(userId: string) {
    const addresses = await db.address.findMany({
      where: { userId },
      orderBy: { isDefault: "desc" },
    });

    return { data: addresses };
  }

  /**
   * Add address
   */
  async addAddress(userId: string, data: any) {
    // If this is the first address, set it as default
    const existingAddresses = await db.address.findMany({
      where: { userId },
    });

    const address = await db.address.create({
      data: {
        ...data,
        userId,
        isDefault: existingAddresses.length === 0,
      },
    });

    return address;
  }

  /**
   * Update address
   */
  async updateAddress(userId: string, addressId: string, data: any) {
    const address = await db.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Address not found",
      };
    }

    return await db.address.update({
      where: { id: addressId },
      data,
    });
  }

  /**
   * Delete address
   */
  async deleteAddress(userId: string, addressId: string) {
    const address = await db.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw {
        status: 404,
        type: "https://api.shop.am/problems/not-found",
        title: "Address not found",
      };
    }

    await db.address.delete({
      where: { id: addressId },
    });

    return null;
  }

  /**
   * Set default address
   */
  async setDefaultAddress(userId: string, addressId: string) {
    // Unset all other default addresses
    await db.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    return await db.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  /**
   * Get user dashboard statistics
   */
  async getDashboard(userId: string) {
    // Get all orders for the user
    const orders = await db.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate statistics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o: { status: string }) => o.status === "pending").length;
    const completedOrders = orders.filter((o: { status: string }) => o.status === "completed").length;
    const totalSpent = orders
      .filter((o: { status: string; paymentStatus: string }) => o.status === "completed" || o.paymentStatus === "paid")
      .reduce((sum: number, o: { total: number }) => sum + o.total, 0);

    // Count addresses
    const addressesCount = await db.address.count({
      where: { userId },
    });

    // Count orders by status
    const ordersByStatus: Record<string, number> = {};
    orders.forEach((order: { status: string }) => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    });

    // Get recent orders (last 5)
    const recentOrders = orders.slice(0, 5).map((order: { id: string; number: string; status: string; paymentStatus: string; fulfillmentStatus: string; total: number; currency: string | null; createdAt: Date; items: Array<unknown> }) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      total: order.total,
      currency: order.currency,
      itemsCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
    }));

    return {
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalSpent,
        addressesCount,
        ordersByStatus,
      },
      recentOrders,
    };
  }
}

export const usersService = new UsersService();


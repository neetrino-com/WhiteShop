const User = require('../models/User');
const bcrypt = require('bcryptjs');

const usersController = {
  /**
   * Get user profile
   * GET /api/v1/users/profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .select('-passwordHash')
        .lean();

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      res.json({
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        locale: user.locale,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        addresses: user.addresses || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update user profile
   * PUT /api/v1/users/profile
   */
  async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, email, phone, locale } = req.body;

      const updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (locale !== undefined) updateData.locale = locale;

      // Check for duplicate email/phone
      if (email || phone) {
        const existing = await User.findOne({
          _id: { $ne: req.user.id },
          $or: [
            email ? { email } : {},
            phone ? { phone } : {},
          ],
        });

        if (existing) {
          return res.status(409).json({
            type: 'https://api.shop.am/problems/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Email or phone already in use',
            instance: req.path,
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-passwordHash');

      res.json({
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        locale: user.locale,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Change password
   * PUT /api/v1/users/password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Current password and new password are required',
          instance: req.path,
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'New password must be at least 6 characters',
          instance: req.path,
        });
      }

      const user = await User.findById(req.user.id);

      if (!user || !user.passwordHash) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({
          type: 'https://api.shop.am/problems/unauthorized',
          title: 'Invalid password',
          status: 401,
          detail: 'Current password is incorrect',
          instance: req.path,
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.passwordHash = hashedPassword;
      await user.save();

      res.json({
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all addresses
   * GET /api/v1/users/addresses
   */
  async getAddresses(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .select('addresses')
        .lean();

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      res.json({
        addresses: user.addresses || [],
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add address
   * POST /api/v1/users/addresses
   */
  async addAddress(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        company,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        countryCode,
        phone,
        isDefault,
      } = req.body;

      if (!addressLine1 || !city) {
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Address line 1 and city are required',
          instance: req.path,
        });
      }

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        if (user.addresses) {
          user.addresses.forEach((addr) => {
            addr.isDefault = false;
          });
        }
      }

      const newAddress = {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        company,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        countryCode: countryCode || 'AM',
        phone: phone || user.phone,
        isDefault: isDefault || false,
      };

      if (!user.addresses) {
        user.addresses = [];
      }

      // If this is the first address, make it default
      if (user.addresses.length === 0) {
        newAddress.isDefault = true;
      }

      user.addresses.push(newAddress);
      await user.save();

      res.status(201).json({
        address: newAddress,
        message: 'Address added successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update address
   * PUT /api/v1/users/addresses/:addressId
   */
  async updateAddress(req, res, next) {
    try {
      const { addressId } = req.params;
      const {
        firstName,
        lastName,
        company,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        countryCode,
        phone,
        isDefault,
      } = req.body;

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      const addressIndex = user.addresses?.findIndex(
        (addr) => addr._id.toString() === addressId
      );

      if (addressIndex === -1 || addressIndex === undefined) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Address not found',
          status: 404,
          instance: req.path,
        });
      }

      // If setting as default, unset other defaults
      if (isDefault === true) {
        user.addresses.forEach((addr, idx) => {
          if (idx !== addressIndex) {
            addr.isDefault = false;
          }
        });
      }

      // Update address fields
      const address = user.addresses[addressIndex];
      if (firstName !== undefined) address.firstName = firstName;
      if (lastName !== undefined) address.lastName = lastName;
      if (company !== undefined) address.company = company;
      if (addressLine1 !== undefined) address.addressLine1 = addressLine1;
      if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
      if (city !== undefined) address.city = city;
      if (state !== undefined) address.state = state;
      if (postalCode !== undefined) address.postalCode = postalCode;
      if (countryCode !== undefined) address.countryCode = countryCode;
      if (phone !== undefined) address.phone = phone;
      if (isDefault !== undefined) address.isDefault = isDefault;

      await user.save();

      res.json({
        address,
        message: 'Address updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete address
   * DELETE /api/v1/users/addresses/:addressId
   */
  async deleteAddress(req, res, next) {
    try {
      const { addressId } = req.params;

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      const addressIndex = user.addresses?.findIndex(
        (addr) => addr._id.toString() === addressId
      );

      if (addressIndex === -1 || addressIndex === undefined) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Address not found',
          status: 404,
          instance: req.path,
        });
      }

      const wasDefault = user.addresses[addressIndex].isDefault;

      user.addresses.splice(addressIndex, 1);

      // If deleted address was default and there are other addresses, set first one as default
      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      await user.save();

      res.json({
        message: 'Address deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Set default address
   * PATCH /api/v1/users/addresses/:addressId/default
   */
  async setDefaultAddress(req, res, next) {
    try {
      const { addressId } = req.params;

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'User not found',
          status: 404,
          instance: req.path,
        });
      }

      const addressIndex = user.addresses?.findIndex(
        (addr) => addr._id.toString() === addressId
      );

      if (addressIndex === -1 || addressIndex === undefined) {
        return res.status(404).json({
          type: 'https://api.shop.am/problems/not-found',
          title: 'Address not found',
          status: 404,
          instance: req.path,
        });
      }

      // Unset all defaults
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });

      // Set this one as default
      user.addresses[addressIndex].isDefault = true;

      await user.save();

      res.json({
        address: user.addresses[addressIndex],
        message: 'Default address updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = usersController;

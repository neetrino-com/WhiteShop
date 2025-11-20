const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const { email, phone, password, firstName, lastName } = req.body;

      console.log('🔐 [AUTH] Registration attempt:', { 
        email: email || 'not provided', 
        phone: phone || 'not provided',
        hasFirstName: !!firstName,
        hasLastName: !!lastName 
      });

      if (!email && !phone) {
        console.log('❌ [AUTH] Validation failed: email or phone required');
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Either email or phone is required',
          instance: req.path,
        });
      }

      if (!password || password.length < 6) {
        console.log('❌ [AUTH] Validation failed: password too short');
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Password must be at least 6 characters',
          instance: req.path,
        });
      }

      // Check if user already exists - build query properly
      const queryConditions = [];
      if (email) {
        queryConditions.push({ email });
      }
      if (phone) {
        queryConditions.push({ phone });
      }

      const existingUser = await User.findOne({
        $or: queryConditions,
        deletedAt: null,
      });

      if (existingUser) {
        console.log('❌ [AUTH] User already exists:', existingUser.email || existingUser.phone);
        return res.status(409).json({
          type: 'https://api.shop.am/problems/conflict',
          title: 'User already exists',
          status: 409,
          detail: 'User with this email or phone already exists',
          instance: req.path,
        });
      }

      // Hash password
      console.log('🔒 [AUTH] Hashing password...');
      const passwordHash = await bcrypt.hash(password, 10);
      console.log('✅ [AUTH] Password hashed successfully');

      // Create user
      console.log('💾 [AUTH] Creating user in database...');
      console.log('💾 [AUTH] User data:', {
        email: email || 'undefined',
        phone: phone || 'undefined',
        hasPasswordHash: !!passwordHash,
        firstName: firstName || 'undefined',
        lastName: lastName || 'undefined',
      });

      let user;
      try {
        user = await User.create({
          email: email || undefined,
          phone: phone || undefined,
          passwordHash,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          locale: 'en',
          roles: ['customer'],
        });
        console.log('✅ [AUTH] User created successfully in database');
      } catch (createError) {
        console.error('❌ [AUTH] User creation failed:', createError);
        console.error('❌ [AUTH] Error details:', {
          message: createError.message,
          code: createError.code,
          name: createError.name,
          stack: createError.stack,
        });
        
        if (createError.code === 11000) {
          // MongoDB duplicate key error
          return res.status(409).json({
            type: 'https://api.shop.am/problems/conflict',
            title: 'User already exists',
            status: 409,
            detail: 'User with this email or phone already exists',
            instance: req.path,
          });
        }
        throw createError;
      }

      console.log('✅ [AUTH] User created successfully:', {
        id: user._id.toString(),
        email: user.email || 'N/A',
        phone: user.phone || 'N/A',
        firstName: user.firstName || 'N/A',
        lastName: user.lastName || 'N/A',
      });

      // Generate JWT token
      if (!process.env.JWT_SECRET) {
        console.error('❌ [AUTH] JWT_SECRET is not set!');
        return res.status(500).json({
          type: 'https://api.shop.am/problems/internal-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Server configuration error',
          instance: req.path,
        });
      }

      console.log('🎫 [AUTH] Generating JWT token...');
      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      console.log('✅ [AUTH] JWT token generated');

      const responseData = {
        user: {
          id: user._id.toString(),
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || ['customer'],
        },
        token,
      };

      console.log('📤 [AUTH] Sending response:', {
        hasUser: !!responseData.user,
        hasToken: !!responseData.token,
        userId: responseData.user.id,
      });

      res.status(201).json(responseData);
    } catch (error) {
      console.error('❌ [AUTH] Registration error:', error);
      console.error('❌ [AUTH] Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
      });
      
      if (error.code === 11000) {
        // MongoDB duplicate key error
        return res.status(409).json({
          type: 'https://api.shop.am/problems/conflict',
          title: 'User already exists',
          status: 409,
          detail: 'User with this email or phone already exists',
          instance: req.path,
        });
      }
      next(error);
    }
  },

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, phone, password } = req.body;

      console.log('🔐 [AUTH] Login attempt:', { 
        email: email || 'not provided', 
        phone: phone || 'not provided' 
      });

      if (!email && !phone) {
        console.log('❌ [AUTH] Validation failed: email or phone required');
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Either email or phone is required',
          instance: req.path,
        });
      }

      if (!password) {
        console.log('❌ [AUTH] Validation failed: password required');
        return res.status(400).json({
          type: 'https://api.shop.am/problems/validation-error',
          title: 'Validation failed',
          status: 400,
          detail: 'Password is required',
          instance: req.path,
        });
      }

      // Find user - build query properly
      const queryConditions = [];
      if (email) {
        queryConditions.push({ email });
      }
      if (phone) {
        queryConditions.push({ phone });
      }

      console.log('🔍 [AUTH] Searching for user in database...');
      const user = await User.findOne({
        $or: queryConditions,
        deletedAt: null,
      });

      if (!user || !user.passwordHash) {
        console.log('❌ [AUTH] User not found or no password set');
        return res.status(401).json({
          type: 'https://api.shop.am/problems/unauthorized',
          title: 'Invalid credentials',
          status: 401,
          detail: 'Invalid email/phone or password',
          instance: req.path,
        });
      }

      console.log('✅ [AUTH] User found:', user._id.toString());

      // Check password
      console.log('🔒 [AUTH] Verifying password...');
      const isValidPassword = await user.comparePassword(password);
      
      if (!isValidPassword) {
        console.log('❌ [AUTH] Invalid password');
        return res.status(401).json({
          type: 'https://api.shop.am/problems/unauthorized',
          title: 'Invalid credentials',
          status: 401,
          detail: 'Invalid email/phone or password',
          instance: req.path,
        });
      }

      if (user.blocked) {
        console.log('❌ [AUTH] Account is blocked');
        return res.status(403).json({
          type: 'https://api.shop.am/problems/forbidden',
          title: 'Account blocked',
          status: 403,
          detail: 'Your account has been blocked',
          instance: req.path,
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      console.log('✅ [AUTH] Login successful, token generated');

      res.json({
        user: {
          id: user._id.toString(),
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || ['customer'],
        },
        token,
      });
    } catch (error) {
      console.error('❌ [AUTH] Login error:', error.message);
      next(error);
    }
  },
};

module.exports = authController;

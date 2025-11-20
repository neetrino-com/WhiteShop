const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        type: 'https://api.shop.am/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication token required',
        instance: req.path,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId)
      .select('-passwordHash')
      .lean();

    if (!user || user.blocked || user.deletedAt) {
      return res.status(401).json({
        type: 'https://api.shop.am/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired token',
        instance: req.path,
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      roles: user.roles || ['customer'],
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        type: 'https://api.shop.am/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired token',
        instance: req.path,
      });
    }
    next(error);
  }
};

/**
 * Check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      type: 'https://api.shop.am/problems/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authentication required',
      instance: req.path,
    });
  }

  const isAdmin = req.user.roles && req.user.roles.includes('admin');
  
  if (!isAdmin) {
    return res.status(403).json({
      type: 'https://api.shop.am/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Admin access required',
      instance: req.path,
    });
  }

  next();
};

module.exports = { authenticateToken, requireAdmin };

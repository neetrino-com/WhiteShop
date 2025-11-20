const Redis = require('ioredis');

// Prevent error spam
let errorLogged = false;
let lastErrorTime = 0;
const ERROR_COOLDOWN = 30000; // Only log errors every 30 seconds
let connectionAttempted = false;
let redisAvailable = false;

// Check if Redis URL is explicitly set (not default)
const redisUrl = process.env.REDIS_URL;
const useRedis = redisUrl && redisUrl !== 'redis://localhost:6379';

const redis = new Redis(redisUrl || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts if Redis is not explicitly configured
    if (!useRedis && times > 3) {
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect immediately
  showFriendlyErrorStack: true,
  // Disable automatic reconnection if Redis is not explicitly configured
  enableOfflineQueue: false,
  // Disable automatic reconnect to prevent spam
  reconnectOnError: (err) => {
    return false; // Don't auto-reconnect
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
  errorLogged = false;
  redisAvailable = true;
});

redis.on('ready', () => {
  redisAvailable = true;
});

redis.on('error', (error) => {
  redisAvailable = false;
  const now = Date.now();
  // Only log errors if:
  // 1. First error, or
  // 2. More than ERROR_COOLDOWN ms have passed since last error
  if (!errorLogged || (now - lastErrorTime) > ERROR_COOLDOWN) {
    if (!useRedis) {
      // Only log once if Redis is not explicitly configured
      if (!connectionAttempted) {
        console.warn('⚠️  Redis not available (using default localhost:6379)');
        console.warn('💡 Redis is optional - server will continue without cache');
        console.warn('💡 To enable Redis: Set REDIS_URL in .env or start Redis server');
        connectionAttempted = true;
        errorLogged = true;
      }
    } else {
      console.error('⚠️  Redis connection error:', error.message);
      console.error('💡 Check REDIS_URL in .env or start Redis server');
      errorLogged = true;
      lastErrorTime = now;
    }
  }
});

// Only try to connect if Redis is explicitly configured
if (useRedis) {
  redis.connect()
    .then(() => {
      console.log('✅ Redis connected');
      redisAvailable = true;
    })
    .catch((error) => {
      // Errors are handled by the error event handler above
    });
} else {
  // Silently skip Redis if not configured
  connectionAttempted = true;
}

// Safe Redis wrapper functions
const safeRedis = {
  async get(key) {
    if (!redisAvailable) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      return null;
    }
  },

  async set(key, value) {
    if (!redisAvailable) return;
    try {
      await redis.set(key, value);
    } catch (error) {
      // Silently fail
    }
  },

  async setex(key, seconds, value) {
    if (!redisAvailable) return;
    try {
      await redis.setex(key, seconds, value);
    } catch (error) {
      // Silently fail
    }
  },

  async del(key) {
    if (!redisAvailable) return;
    try {
      await redis.del(key);
    } catch (error) {
      // Silently fail
    }
  },

  async keys(pattern) {
    if (!redisAvailable) return [];
    try {
      return await redis.keys(pattern);
    } catch (error) {
      return [];
    }
  },
};

module.exports = { redis, safeRedis };


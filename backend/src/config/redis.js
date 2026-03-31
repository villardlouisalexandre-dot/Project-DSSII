const Redis = require('ioredis');

let redisClient = null;
let isConnected = false;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      },
      maxRetriesPerRequest: 1,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      if (isConnected) {
        console.warn('⚠️  Redis error:', err.message);
      }
      isConnected = false;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  }
  return redisClient;
}

async function connectRedis() {
  try {
    const client = getRedisClient();
    await client.connect();
    isConnected = true;
  } catch (err) {
    console.warn('⚠️  Redis not available - running without cache:', err.message);
    isConnected = false;
  }
}

function isRedisConnected() {
  return isConnected;
}

module.exports = { getRedisClient, connectRedis, isRedisConnected };

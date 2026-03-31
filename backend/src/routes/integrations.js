const express = require('express');
const { isRedisConnected, getRedisClient } = require('../config/redis');
const { isRabbitMQConnected } = require('../config/rabbitmq');

const router = express.Router();

/**
 * @swagger
 * /api/integrations/redis/health:
 *   get:
 *     summary: Check Redis connection health
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Redis is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 service: { type: string }
 *       503:
 *         description: Redis is not available
 */
router.get('/redis/health', async (req, res) => {
  if (isRedisConnected()) {
    try {
      await getRedisClient().ping();
      return res.status(200).json({ status: 'connected', service: 'redis' });
    } catch (e) {
      return res.status(503).json({ status: 'unavailable', service: 'redis', detail: e.message });
    }
  }
  return res.status(503).json({ status: 'unavailable', service: 'redis' });
});

/**
 * @swagger
 * /api/integrations/rabbitmq/health:
 *   get:
 *     summary: Check RabbitMQ connection health
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: RabbitMQ is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 service: { type: string }
 *       503:
 *         description: RabbitMQ is not available
 */
router.get('/rabbitmq/health', (req, res) => {
  if (isRabbitMQConnected()) {
    return res.status(200).json({ status: 'connected', service: 'rabbitmq' });
  }
  return res.status(503).json({ status: 'unavailable', service: 'rabbitmq' });
});

module.exports = router;

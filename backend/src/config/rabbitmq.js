const amqp = require('amqplib');

let connection = null;
let channel = null;
let isConnected = false;

const EXCHANGE_NAME = 'todo_events';

async function connectRabbitMQ() {
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Create audit log queue
    await channel.assertQueue('todo_audit_log', { durable: true });
    await channel.bindQueue('todo_audit_log', EXCHANGE_NAME, 'todo.*');

    isConnected = true;
    console.log('✅ RabbitMQ connected');

    connection.on('error', (err) => {
      console.warn('⚠️  RabbitMQ error:', err.message);
      isConnected = false;
    });

    connection.on('close', () => {
      console.warn('⚠️  RabbitMQ connection closed');
      isConnected = false;
    });

  } catch (err) {
    console.warn('⚠️  RabbitMQ not available - running without messaging:', err.message);
    isConnected = false;
  }
}

async function publishEvent(eventType, data) {
  if (!isConnected || !channel) return;

  try {
    const message = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    });

    channel.publish(
      EXCHANGE_NAME,
      `todo.${eventType.toLowerCase()}`,
      Buffer.from(message),
      { persistent: true }
    );
  } catch (err) {
    console.warn('⚠️  Failed to publish event:', err.message);
  }
}

function isRabbitMQConnected() {
  return isConnected;
}

module.exports = { connectRabbitMQ, publishEvent, isRabbitMQConnected };

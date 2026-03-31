require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');
const pool = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');
const integrationRoutes = require('./routes/integrations');

const app = express();
const PORT = process.env.PORT || 3087;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
  customSiteTitle: 'DSS2 Todo API',
}));

// Swagger JSON
app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/integrations', integrationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    type: 'https://httpstatuses.com/404',
    title: 'Not Found',
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use(errorHandler);

async function startServer() {
  // Connect to optional services (won't fail if not available)
  await connectRedis();
  await connectRabbitMQ();

  // Wait for DB connection
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('❌ Cannot connect to database after multiple attempts');
        process.exit(1);
      }
      console.log(`⏳ Waiting for database... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Run migrations automatically in Docker/production
  if (process.env.RUN_MIGRATIONS === 'true') {
    const fs = require('fs');
    const path = require('path');
    const client = await pool.connect();
    try {
      const sql = fs.readFileSync(path.join(__dirname, 'migrations/001_init.sql'), 'utf8');
      await client.query(sql);
      console.log('✅ Migrations applied');
    } catch (err) {
      console.error('⚠️  Migration warning:', err.message);
    } finally {
      client.release();
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📖 Swagger UI: http://localhost:${PORT}/api/docs`);
    console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;

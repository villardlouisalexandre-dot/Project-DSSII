const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 254
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 128
 *                 example: P@ssw0rd!
 *               displayName:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation
    const errors = {};

    if (!email || typeof email !== 'string') {
      errors.email = ['Email is required'];
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = ['Invalid email format'];
    } else if (email.length > 254) {
      errors.email = ['Email must not exceed 254 characters'];
    }

    if (!password || typeof password !== 'string') {
      errors.password = ['Password is required'];
    } else if (password.length < 6) {
      errors.password = ['Password must be at least 6 characters'];
    } else if (password.length > 128) {
      errors.password = ['Password must not exceed 128 characters'];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Validation failed',
        status: 400,
        errors,
      });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        type: 'https://httpstatuses.com/409',
        title: 'Conflict',
        status: 409,
        detail: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Insert user
    await pool.query(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [userId, email.toLowerCase(), passwordHash, displayName || null]
    );

    return res.status(201).json({
      id: userId,
      email: email.toLowerCase(),
      displayName: displayName || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and obtain JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: P@ssw0rd!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    const errors = {};

    if (!email || typeof email !== 'string') {
      errors.email = ['Email is required'];
    } else if (email.length > 254) {
      errors.email = ['Email must not exceed 254 characters'];
    }

    if (!password || typeof password !== 'string') {
      errors.password = ['Password is required'];
    } else if (password.length > 128) {
      errors.password = ['Password must not exceed 128 characters'];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Validation failed',
        status: 400,
        errors,
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
      });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
      });
    }

    // Generate JWT
    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600');
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn }
    );

    return res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: expiresIn,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

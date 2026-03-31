const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getRedisClient, isRedisConnected } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_SORT_BY = ['createdAt', 'dueDate', 'priority', 'title'];
const VALID_SORT_DIR = ['asc', 'desc'];
const VALID_STATUS = ['all', 'active', 'completed'];

const PUBLIC_TODOS_CACHE_KEY = 'public_todos';
const PUBLIC_TODOS_TTL = 60; // seconds

// Map JS field names to DB column names
const SORT_FIELD_MAP = {
  createdAt: 'created_at',
  dueDate: 'due_date',
  priority: "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END",
  title: 'title',
};

function buildTodoResponse(row) {
  return {
    id: row.id,
    title: row.title,
    details: row.details || null,
    priority: row.priority,
    dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
    isCompleted: row.is_completed,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parsePaginationParams(query) {
  const errors = {};
  let page = parseInt(query.page) || 1;
  let pageSize = parseInt(query.pageSize) || 10;

  if (isNaN(page) || page < 1) errors.page = ['page must be >= 1'];
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 50) errors.pageSize = ['pageSize must be between 1 and 50'];

  return { page, pageSize, errors };
}

// Validate and parse query filters — returns { filters, errors }
function parseQueryFilters(query) {
  const errors = {};

  // Helper: treat empty string as undefined
  const str = (val) => (val && val.trim() !== '' ? val.trim() : undefined);

  const status   = str(query.status);
  const priority = str(query.priority);
  const sortBy   = str(query.sortBy);
  const sortDir  = str(query.sortDir);
  const dueFrom  = str(query.dueFrom);
  const dueTo    = str(query.dueTo);
  const search   = str(query.search);

  // Strict enum validation — return 400 if invalid value provided
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    errors.status = [`status must be one of: ${VALID_STATUS.join(', ')}`];
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    errors.priority = [`priority must be one of: ${VALID_PRIORITIES.join(', ')}`];
  }
  if (sortBy !== undefined && !VALID_SORT_BY.includes(sortBy)) {
    errors.sortBy = [`sortBy must be one of: ${VALID_SORT_BY.join(', ')}`];
  }
  if (sortDir !== undefined && !VALID_SORT_DIR.includes(sortDir)) {
    errors.sortDir = [`sortDir must be one of: ${VALID_SORT_DIR.join(', ')}`];
  }

  // Date format validation (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dueFrom !== undefined && !dateRegex.test(dueFrom)) {
    errors.dueFrom = ['dueFrom must be in YYYY-MM-DD format'];
  }
  if (dueTo !== undefined && !dateRegex.test(dueTo)) {
    errors.dueTo = ['dueTo must be in YYYY-MM-DD format'];
  }

  // Search length
  if (search !== undefined && search.length > 100) {
    errors.search = ['search must be 100 characters or less'];
  }

  return {
    errors,
    filters: {
      status:   status   || 'all',
      priority: priority,
      sortBy:   sortBy   || 'createdAt',
      sortDir:  sortDir  || 'desc',
      dueFrom:  dueFrom,
      dueTo:    dueTo,
      search:   search,
    },
  };
}

function buildWhereClause(filters, paramOffset = 1) {
  const conditions = [];
  const params = [];
  let idx = paramOffset;

  if (filters.isPublic !== undefined) {
    conditions.push(`is_public = $${idx++}`);
    params.push(filters.isPublic);
  }
  if (filters.userId !== undefined) {
    conditions.push(`user_id = $${idx++}`);
    params.push(filters.userId);
  }
  if (filters.status === 'active') {
    conditions.push(`is_completed = false`);
  } else if (filters.status === 'completed') {
    conditions.push(`is_completed = true`);
  }
  if (filters.priority) {
    conditions.push(`priority = $${idx++}`);
    params.push(filters.priority);
  }
  if (filters.dueFrom) {
    conditions.push(`due_date >= $${idx++}`);
    params.push(filters.dueFrom);
  }
  if (filters.dueTo) {
    conditions.push(`due_date <= $${idx++}`);
    params.push(filters.dueTo);
  }
  if (filters.search) {
    conditions.push(`(title ILIKE $${idx} OR details ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  return {
    where: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
    nextIdx: idx,
  };
}

function validateTodoBody(body, isUpdate = false) {
  const errors = {};
  const { title, details, priority, dueDate } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
    errors.title = ['Title must be between 3 and 100 characters.'];
  }
  if (details !== undefined && details !== null && typeof details === 'string' && details.length > 1000) {
    errors.details = ['Details must not exceed 1000 characters.'];
  }
  if (!priority || !VALID_PRIORITIES.includes(priority)) {
    errors.priority = [`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`];
  }
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      errors.dueDate = ['dueDate must be in YYYY-MM-DD format.'];
    }
  }
  if (isUpdate) {
    if (body.isCompleted !== undefined && typeof body.isCompleted !== 'boolean') {
      errors.isCompleted = ['isCompleted must be a boolean.'];
    }
    if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
      errors.isPublic = ['isPublic must be a boolean.'];
    }
  }

  return errors;
}

/**
 * @swagger
 * /api/todos/public:
 *   get:
 *     summary: List public todos (no auth required)
 *     tags: [Todos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, active, completed], default: all }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high] }
 *       - in: query
 *         name: dueFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dueTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, dueDate, priority, title], default: createdAt }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of public todos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTodos'
 */
router.get('/public', async (req, res, next) => {
  try {
    const { page, pageSize, errors: pageErrors } = parsePaginationParams(req.query);
    const { filters, errors: filterErrors } = parseQueryFilters(req.query);
    const allErrors = { ...pageErrors, ...filterErrors };
    if (Object.keys(allErrors).length > 0) {
      return res.status(400).json({ type: 'https://httpstatuses.com/400', title: 'Validation failed', status: 400, errors: allErrors });
    }

    const { status, priority, sortBy, sortDir, dueFrom, dueTo, search } = filters;

    // Try Redis cache for default (no filters) public todos
    const cacheKey = `${PUBLIC_TODOS_CACHE_KEY}:${JSON.stringify(req.query)}`;
    if (isRedisConnected()) {
      try {
        const cached = await getRedisClient().get(cacheKey);
        if (cached) {
          return res.status(200).json(JSON.parse(cached));
        }
      } catch (e) { /* ignore cache errors */ }
    }

    const { where, params, nextIdx } = buildWhereClause({
      isPublic: true,
      status,
      priority,
      dueFrom,
      dueTo,
      search,
    });

    const sortColumn = sortBy === 'priority'
      ? SORT_FIELD_MAP.priority
      : SORT_FIELD_MAP[sortBy];

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM todo_items ${where}`,
      params
    );
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    const dataResult = await pool.query(
      `SELECT * FROM todo_items ${where} ORDER BY ${sortColumn} ${sortDir.toUpperCase()} LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, pageSize, offset]
    );

    const result = {
      items: dataResult.rows.map(buildTodoResponse),
      page,
      pageSize,
      totalItems,
      totalPages,
    };

    // Cache in Redis
    if (isRedisConnected()) {
      try {
        await getRedisClient().setex(cacheKey, PUBLIC_TODOS_TTL, JSON.stringify(result));
      } catch (e) { /* ignore */ }
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos:
 *   get:
 *     summary: List authenticated user's todos (paged)
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, active, completed], default: all }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high] }
 *       - in: query
 *         name: dueFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dueTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, dueDate, priority, title], default: createdAt }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of todos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTodos'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page, pageSize, errors: pageErrors } = parsePaginationParams(req.query);
    const { filters, errors: filterErrors } = parseQueryFilters(req.query);
    const allErrors = { ...pageErrors, ...filterErrors };
    if (Object.keys(allErrors).length > 0) {
      return res.status(400).json({ type: 'https://httpstatuses.com/400', title: 'Validation failed', status: 400, errors: allErrors });
    }

    const { status, priority, sortBy, sortDir, dueFrom, dueTo, search } = filters;

    const { where, params, nextIdx } = buildWhereClause({
      userId: req.user.userId,
      status,
      priority,
      dueFrom,
      dueTo,
      search,
    });

    const sortColumn = sortBy === 'priority'
      ? SORT_FIELD_MAP.priority
      : SORT_FIELD_MAP[sortBy];

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM todo_items ${where}`,
      params
    );
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    const dataResult = await pool.query(
      `SELECT * FROM todo_items ${where} ORDER BY ${sortColumn} ${sortDir.toUpperCase()} LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, pageSize, offset]
    );

    return res.status(200).json({
      items: dataResult.rows.map(buildTodoResponse),
      page,
      pageSize,
      totalItems,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos:
 *   post:
 *     summary: Create a new todo
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTodoRequest'
 *     responses:
 *       201:
 *         description: Todo created
 *         headers:
 *           Location:
 *             description: URL of the created todo
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TodoResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const errors = validateTodoBody(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ type: 'https://httpstatuses.com/400', title: 'Validation failed', status: 400, errors });
    }

    const { title, details, priority, dueDate, isPublic = false } = req.body;
    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO todo_items (id, user_id, title, details, priority, due_date, is_completed, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), NOW())
       RETURNING *`,
      [id, req.user.userId, title.trim(), details || null, priority, dueDate || null, Boolean(isPublic)]
    );

    const todo = buildTodoResponse(result.rows[0]);

    // Publish RabbitMQ event
    await publishEvent('Created', { todoId: id, userId: req.user.userId, title });

    // Invalidate Redis cache for public todos if this is public
    if (isPublic && isRedisConnected()) {
      try {
        const keys = await getRedisClient().keys(`${PUBLIC_TODOS_CACHE_KEY}:*`);
        if (keys.length > 0) await getRedisClient().del(...keys);
      } catch (e) { /* ignore */ }
    }

    res.setHeader('Location', `/api/todos/${id}`);
    return res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos/{id}:
 *   get:
 *     summary: Get a todo by ID
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Todo found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TodoResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not your todo)
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM todo_items WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ type: 'https://httpstatuses.com/404', title: 'Not Found', status: 404 });
    }

    const todo = result.rows[0];
    if (todo.user_id !== req.user.userId) {
      return res.status(403).json({ type: 'https://httpstatuses.com/403', title: 'Forbidden', status: 403 });
    }

    return res.status(200).json(buildTodoResponse(todo));
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos/{id}:
 *   put:
 *     summary: Update a todo (full replace)
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTodoRequest'
 *     responses:
 *       200:
 *         description: Updated todo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TodoResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM todo_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ type: 'https://httpstatuses.com/404', title: 'Not Found', status: 404 });
    }
    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ type: 'https://httpstatuses.com/403', title: 'Forbidden', status: 403 });
    }

    const errors = validateTodoBody(req.body, true);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ type: 'https://httpstatuses.com/400', title: 'Validation failed', status: 400, errors });
    }

    const { title, details, priority, dueDate, isPublic = false, isCompleted = false } = req.body;

    const result = await pool.query(
      `UPDATE todo_items SET title=$1, details=$2, priority=$3, due_date=$4, is_public=$5, is_completed=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title.trim(), details || null, priority, dueDate || null, Boolean(isPublic), Boolean(isCompleted), req.params.id]
    );

    const todo = buildTodoResponse(result.rows[0]);

    await publishEvent('Updated', { todoId: req.params.id, userId: req.user.userId });

    // Invalidate Redis cache
    if (isRedisConnected()) {
      try {
        const keys = await getRedisClient().keys(`${PUBLIC_TODOS_CACHE_KEY}:*`);
        if (keys.length > 0) await getRedisClient().del(...keys);
      } catch (e) { /* ignore */ }
    }

    return res.status(200).json(todo);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos/{id}/completion:
 *   patch:
 *     summary: Set todo completion status
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isCompleted]
 *             properties:
 *               isCompleted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated todo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TodoResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/:id/completion', authenticateToken, async (req, res, next) => {
  try {
    const { isCompleted } = req.body;

    if (typeof isCompleted !== 'boolean') {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Validation failed',
        status: 400,
        errors: { isCompleted: ['isCompleted must be a boolean'] },
      });
    }

    const existing = await pool.query('SELECT * FROM todo_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ type: 'https://httpstatuses.com/404', title: 'Not Found', status: 404 });
    }
    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ type: 'https://httpstatuses.com/403', title: 'Forbidden', status: 403 });
    }

    const result = await pool.query(
      'UPDATE todo_items SET is_completed=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [isCompleted, req.params.id]
    );

    await publishEvent('Completed', { todoId: req.params.id, userId: req.user.userId, isCompleted });

    return res.status(200).json(buildTodoResponse(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM todo_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ type: 'https://httpstatuses.com/404', title: 'Not Found', status: 404 });
    }
    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ type: 'https://httpstatuses.com/403', title: 'Forbidden', status: 403 });
    }

    await pool.query('DELETE FROM todo_items WHERE id = $1', [req.params.id]);

    await publishEvent('Deleted', { todoId: req.params.id, userId: req.user.userId });

    // Invalidate Redis cache
    if (isRedisConnected()) {
      try {
        const keys = await getRedisClient().keys(`${PUBLIC_TODOS_CACHE_KEY}:*`);
        if (keys.length > 0) await getRedisClient().del(...keys);
      } catch (e) { /* ignore */ }
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

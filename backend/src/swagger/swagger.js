const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DSS2 Todo Management API',
      version: '1.0.0',
      description: 'RESTful API for managing todo items with authentication, pagination, filtering, and sorting.',
    },
    servers: [
      { url: 'http://localhost:3087', description: 'Local Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        AuthUserResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            displayName: { type: 'string', nullable: true },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            tokenType: { type: 'string', example: 'Bearer' },
            expiresInSeconds: { type: 'integer', example: 3600 },
            user: { $ref: '#/components/schemas/AuthUserResponse' },
          },
        },
        TodoResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            details: { type: 'string', nullable: true },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            dueDate: { type: 'string', format: 'date', nullable: true },
            isCompleted: { type: 'boolean' },
            isPublic: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateTodoRequest: {
          type: 'object',
          required: ['title', 'priority'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100, example: 'Buy groceries' },
            details: { type: 'string', maxLength: 1000, example: 'Milk, bread, eggs' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'medium' },
            dueDate: { type: 'string', format: 'date', example: '2026-03-10' },
            isPublic: { type: 'boolean', default: false },
          },
        },
        UpdateTodoRequest: {
          type: 'object',
          required: ['title', 'priority'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100 },
            details: { type: 'string', maxLength: 1000 },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            dueDate: { type: 'string', format: 'date' },
            isPublic: { type: 'boolean' },
            isCompleted: { type: 'boolean' },
          },
        },
        PaginatedTodos: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/TodoResponse' },
            },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            totalItems: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;

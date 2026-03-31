FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3087

# Set environment
ENV NODE_ENV=production
ENV PORT=3087
ENV RUN_MIGRATIONS=true

# Start the application
CMD ["node", "src/app.js"]

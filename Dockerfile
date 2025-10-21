# Dockerfile for Backend
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]

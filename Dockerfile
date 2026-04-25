# ==========================================
# STAGE 1: Build Environment (Frontend & Backend)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies needed for node-gyp or Prisma
RUN apk add --no-cache openssl

# Copy package files and schema first to leverage Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies like Vite & TypeScript)
RUN npm ci

# Generate Prisma Client specifically for the Alpine Linux architecture
RUN npx prisma generate

# Copy the entire monolithic source code
COPY . .

# Build both the Vite Frontend and the TypeScript Backend
# (Assumes package.json has a "build" script mapping to `vite build && tsc`)
RUN npm run build

# ==========================================
# STAGE 2: Production Runner (Lean & Secure)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment to production for extreme performance gains in Express/React
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Copy package files and Prisma schema before install to satisfy postinstall scripts
COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies with flags to avoid failing dev scripts
RUN npm ci --omit=dev --ignore-scripts

# Explicitly generate Prisma client for the production runtime architecture
RUN npx prisma generate

# Copy the built Frontend static files (Assuming Vite outputs to /dist)
COPY --from=builder /app/dist ./dist

# Copy the Backend source code (tsx will run this directly)
COPY server ./server
COPY src ./src
COPY public ./public

# Create uploads directory
RUN mkdir -p server/uploads

# Expose internal port (Nginx will proxy external traffic to this)
EXPOSE 3000

# Start the Node.js application securely
# Run migrations and start the Node.js application securely
CMD npx prisma migrate deploy && npm start

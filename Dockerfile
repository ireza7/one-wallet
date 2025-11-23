FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production deps
RUN npm install --omit=dev

# Copy the rest of the project
COPY . .

# Environment
ENV NODE_ENV=production

# Start the bot
CMD ["node", "src/index.js"]

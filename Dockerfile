FROM node:20-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src ./src
COPY sql ./sql
COPY .env.example ./

ENV NODE_ENV=production

# Run bot and monitor in the same container
CMD ["sh", "-c", "node src/index.js & node src/monitor.js && wait"]

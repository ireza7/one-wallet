FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY backend ./backend
COPY frontend ./frontend
COPY sql ./sql
COPY .env.example ./

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "node backend/app.js & node backend/monitor.js && wait"]

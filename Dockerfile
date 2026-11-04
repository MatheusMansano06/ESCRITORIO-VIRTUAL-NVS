FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY agentes ./agentes
COPY backend/src ./backend/src
COPY frontend/public ./frontend/public
ENV NODE_ENV=production
ENV DATA_DIR=/data
CMD ["node", "backend/src/main.ts"]

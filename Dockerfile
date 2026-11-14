FROM eclipse-temurin:21-jdk-alpine AS backend-build
WORKDIR /build
COPY backend ./backend
RUN sh backend/gradlew -p backend --no-daemon bootJar

FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache openjdk21-jre-headless
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 \
    BACKEND_HOST=127.0.0.1 BACKEND_PORT=8080 \
    TEAM5_BACKEND_URL=http://127.0.0.1:8080 REQUIRE_BACKEND=true \
    COOKIE_SECURE=true NODE_OPTIONS=--max-old-space-size=96 \
    JAVA_TOOL_OPTIONS="-Xms32m -Xmx192m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=32m -XX:+UseSerialGC -Xss256k" \
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3 SERVER_TOMCAT_THREADS_MAX=12
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node server ./server
COPY --from=backend-build --chown=node:node /build/backend/build/libs/*-SNAPSHOT.jar ./backend/app.jar
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "server/cloud.mjs"]

# Home Assistant übergibt BUILD_FROM; die App braucht nur Node, daher das offizielle Node-Image.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8099
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist

LABEL io.hass.type="addon" \
      io.hass.name="Mietabrechnung" \
      io.hass.version="1.1.0"

EXPOSE 8099
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]

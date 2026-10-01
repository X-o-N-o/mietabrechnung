# Wird von GitHub Actions gebaut (siehe .github/workflows/build.yaml); Home Assistant lädt das fertige Image.
# Der Build läuft immer auf der Plattform des Build-Rechners – das Ergebnis ist reines JavaScript
# und damit architekturunabhängig. Die Zielstufe kopiert nur noch Dateien.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ARG BUILD_ARCH=amd64
ARG BUILD_VERSION=dev
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8099
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

LABEL io.hass.type="addon" \
      io.hass.name="Mietabrechnung" \
      io.hass.arch="${BUILD_ARCH}" \
      io.hass.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/X-o-N-o/mietabrechnung" \
      org.opencontainers.image.description="Mietabrechnung – Home-Assistant-Add-on"

EXPOSE 8099
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]

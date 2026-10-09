FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN set -eu;     if npm ci --include=dev && test -x node_modules/.bin/tsc; then       echo "Build dependencies installed with npm ci";     else       echo "npm ci did not install TypeScript; retrying with npm install";       rm -rf node_modules;       npm install --include=dev --legacy-peer-deps;       test -x node_modules/.bin/tsc;     fi
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN set -eu;     if npm ci --omit=dev && npm ls --omit=dev --depth=0 >/dev/null; then       echo "Runtime dependencies installed with npm ci";     else       echo "npm ci did not install runtime dependencies; retrying with npm install";       rm -rf node_modules;       npm install --omit=dev --legacy-peer-deps;       npm ls --omit=dev --depth=0 >/dev/null;     fi
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]

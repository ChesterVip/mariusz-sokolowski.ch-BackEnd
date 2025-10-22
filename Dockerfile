# ---------- Build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Instalujemy pełne zależności (z dev), bo potrzebujemy @nestjs/cli do builda
COPY package*.json ./
RUN npm ci

# Kopiujemy resztę źródeł i budujemy
COPY . .
RUN npm run build

# ---------- Production stage ----------
FROM node:20-alpine AS prod

WORKDIR /app
ENV NODE_ENV=production

# Instalujemy tylko prod deps, żeby obraz był mały i bezpieczny
COPY package*.json ./
RUN npm ci --omit=dev

# Kopiujemy zbudowane artefakty
COPY --from=build /app/dist ./dist

# Jeżeli masz katalog z assetami/konfiguracjami runtime – dorzuć:
# COPY --from=build /app/.env ./.env   # (jeśli używasz .env w obrazie – zwykle NIE; lepiej ENV w Render)

# Render ustawia PORT — upewnij się, że Nest go czyta (process.env.PORT)
EXPOSE 3000

# start:prod powinien robić "node dist/main.js"; jeśli tak, możesz użyć jednej z komend poniżej:
CMD ["node", "dist/main.js"]
# albo:
# CMD ["npm", "run", "start:prod"]

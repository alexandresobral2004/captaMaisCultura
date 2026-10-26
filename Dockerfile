# Imagem própria para o Railway (no lugar do Railpack, que falha no build atual).
# Build em um estágio com compilador (dependências nativas: bcrypt, better-sqlite3);
# runtime enxuto com as dependências já instaladas.

FROM node:22-bookworm-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ libatomic1 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
RUN apt-get update \
 && apt-get install -y --no-install-recommends libatomic1 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
# O Railway injeta PORT; localmente cai na 8080
CMD ["sh", "-c", "npm run start -- -p ${PORT:-8080}"]

# 1. Aşama: Build (Node.js kullanarak projeyi derliyoruz)
FROM node:22-alpine AS build
WORKDIR /app

# Paket yöneticisi pnpm'i aktif ediyoruz (Corepack Node.js ile birlikte gelir)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Bağımlılıkları kopyalayıp yüklüyoruz
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Tüm kodu kopyalayıp build alıyoruz
COPY . .
RUN pnpm run build

# 2. Aşama: Serve (Nginx kullanarak statik dosyaları sunuyoruz)
FROM nginx:stable-alpine

# Build aşamasından gelen dosyaları Nginx'in klasörüne kopyalıyoruz
COPY --from=build /app/dist /usr/share/nginx/html

# Özel Nginx konfigürasyonunu kopyalıyoruz (SPA routing için gerekli)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

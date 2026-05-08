# 1. Aşama: Build (Node.js kullanarak projeyi derliyoruz)
FROM node:22-alpine AS build
WORKDIR /app

# Paket yöneticisi pnpm'i aktif ediyoruz (Corepack Node.js ile birlikte gelir)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Bağımlılıkları kopyalayıp yüklüyoruz
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Supabase anahtarlarını build zamanında içeri aktarıyoruz
ARG VITE_SUPABASE_URL=https://nsftazewqgcugkeetvgy.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZnRhemV3cWdjdWdrZWV0dmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTkzMzQsImV4cCI6MjA1ODYzNTMzNH0.FC_QS1qXC53oNnsQ0a2PIkoHESzDJfGofjDAJJeUhvM
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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

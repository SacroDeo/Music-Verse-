FROM node:20-alpine
RUN apk add --no-cache python3 curl ffmpeg bash

# Download yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# yt-dlp config: use node as JS runtime (node binary is at /usr/local/bin/node in node:alpine)
RUN mkdir -p /root/.config/yt-dlp \
    && echo '--js-runtimes nodejs' > /root/.config/yt-dlp/config

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Startup script: self-update yt-dlp then start server
RUN printf '#!/bin/sh\necho "Updating yt-dlp..."\nyt-dlp -U || true\necho "Starting server..."\nexec node server.js\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]
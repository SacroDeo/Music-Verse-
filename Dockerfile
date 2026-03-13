FROM node:20-alpine

RUN apk add --no-cache python3 curl ffmpeg bash

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Verify node path and create yt-dlp config pointing to it
RUN which node && node --version
RUN mkdir -p /root/.config/yt-dlp \
    && echo "--js-runtimes nodejs:$(which node)" > /root/.config/yt-dlp/config \
    && cat /root/.config/yt-dlp/config

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Runtime startup: update yt-dlp to latest, then start
RUN printf '#!/bin/sh\necho "==> node path: $(which node)"\necho "==> yt-dlp version before update: $(yt-dlp --version)"\nyt-dlp -U 2>&1 || true\necho "==> yt-dlp version after update: $(yt-dlp --version)"\necho "==> yt-dlp config:"\ncat /root/.config/yt-dlp/config\nexec node server.js\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]
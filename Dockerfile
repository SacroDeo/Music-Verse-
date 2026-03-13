FROM node:20-alpine

RUN apk add --no-cache python3 curl ffmpeg bash

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# CORRECT runtime name is "node" not "nodejs"
RUN mkdir -p /root/.config/yt-dlp \
    && echo "--js-runtimes node:$(which node)" > /root/.config/yt-dlp/config \
    && cat /root/.config/yt-dlp/config

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

RUN printf '#!/bin/sh\nyt-dlp -U 2>&1 || true\nexec node server.js\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]
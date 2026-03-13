FROM node:20-alpine
RUN apk add --no-cache python3 curl ffmpeg bash
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp
# Configure yt-dlp to use node as JS runtime (node is available via base image)
RUN mkdir -p /root/.config/yt-dlp \
    && printf -- '--js-runtimes nodejs\n--js-runtimes nodejs:/usr/local/bin/node\n' > /root/.config/yt-dlp/config
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
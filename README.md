
---

# 🎵 YouTube Music Player API

This project is a **Node.js + Express server** that lets you **search, stream, and download YouTube videos/audio** using the **YouTube Data API** and **yt-dlp**.

It provides a simple backend that can power a music player or media streaming application.

---

## 🚀 Features

* 🔍 **Search YouTube videos** by query using the YouTube Data API
* 🎥 **Stream YouTube videos** directly as MP4 without downloading first
* 🎶 **Download YouTube audio (MP3 format)** from any video
* ⚡ Fast & lightweight using `express` and `yt-dlp`
* 🔒 Basic security enhancements (`X-Powered-By` header disabled)

---

## 📂 Project Structure

```
project-root/
│── public/               # Static frontend files (served automatically)
│── server.js             # Main Express server
│── package.json          # Dependencies and project metadata
│── package-lock.json     # Dependency tree lock
│── .env                  # Environment variables (API key, port, etc.)
│── yt-dlp / yt-dlp.exe   # YouTube downloader binary (required)
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/music-player2.git
cd music-player2
```

### 2️⃣ Install Dependencies

```bash
npm install
```

Dependencies used:

* `express` → Web server
* `dotenv` → Environment variable management
* `node-fetch` → Fetch API in Node
* `uuid` → Unique ID generation
* `nodemon` (dev) → Auto-restart server

### 3️⃣ Install `yt-dlp`

This project depends on [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) for downloading & streaming YouTube content.

* **Linux/Mac**:

  ```bash
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
  sudo chmod +x yt-dlp
  ```
* **Windows**:
  Download `yt-dlp.exe` and place it in the project root.

### 4️⃣ Set Environment Variables

Create a `.env` file in the root:

```ini
YT_API_KEY=your_youtube_api_key
PORT=8080
```

👉 You can get a **YouTube API Key** from [Google Cloud Console](https://console.cloud.google.com/).

---

## ▶️ Running the Server

### Development (auto-restart on changes):

```bash
npm run dev
```

### Production:

```bash
npm start
```

Server will run at:

```
http://localhost:8080
```

---

## 📡 API Endpoints

### 🔍 Search Videos

```
GET /search?q=your_query
```

**Response:**

```json
[
  {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up"
  }
]
```

---

### 🎥 Stream Video

```
GET /stream?id=VIDEO_ID
```

* Streams the video as **MP4** directly to the client.

---

### 🎶 Download Audio (MP3)

```
GET /download?id=VIDEO_ID
```

* Downloads the best audio track as an **MP3 file**.
* The filename is based on the video title.

---

## 🛠️ Error Handling

* Missing API key → Server won’t start
* Invalid/missing query → `400 Bad Request`
* Video not found → `404 Not Found`
* yt-dlp errors → `500 Internal Server Error`

---

## 🔒 Security Notes

* `X-Powered-By` header disabled to reduce attack surface
* Relies on external `yt-dlp` binary → ensure it’s up-to-date
* API key is stored securely in `.env` (do not commit this file)

---

## 🖥️ Example Workflow

1. Start the server:

   ```bash
   npm run dev
   ```
2. Open browser at:

   ```
   http://localhost:8080
   ```
3. Call APIs:

   * Search → `http://localhost:8080/search?q=eminem`
   * Stream → `http://localhost:8080/stream?id=VIDEO_ID`
   * Download → `http://localhost:8080/download?id=VIDEO_ID`

---

## 📌 Future Improvements

* Add pagination & filters for search results
* Cache search & download results to reduce API calls
* Add frontend player UI in `/public`
* Implement authentication for API usage

---

## 📜 License

This project is licensed under the **MIT License**.

---



const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const https = require('https');

dotenv.config();

const app = express();
const YT_API_KEY = process.env.YT_API_KEY;

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

/* ── HTTPS helper ── */
function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function extractPlaylistId(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const idx = parts.indexOf('playlist');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
  } catch (_) {}
  const m = url.match(/playlist[/:]+([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/* ── Get yt-dlp path ── */
function getYtDlpPath() {
  if (process.platform === 'win32') return path.join(__dirname, 'yt-dlp.exe');
  return '/usr/local/bin/yt-dlp';
}

/* ── Get cookies path ── */
function getCookiesPath() {
  if (process.platform === 'win32') return path.join(__dirname, 'www.youtube.com_cookies.txt');
  return '/app/www.youtube.com_cookies.txt';
}

/* ── Spotify playlist endpoint ── */
app.post('/spotify/playlist', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    const playlistId = extractPlaylistId(url);
    if (!playlistId) return res.status(400).json({ error: 'Invalid Spotify playlist URL' });

    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    console.log('Fetching embed:', embedUrl);

    const r = await httpRequest(embedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': 'https://www.google.com/'
      }
    });

    console.log('Embed status:', r.status);
    console.log('Body preview:', r.body.slice(0, 300));

    if (r.status !== 200) {
      return res.status(400).json({ error: `Spotify embed returned ${r.status}. Playlist may be private.` });
    }

    const match = r.body.match(/<script id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      const match2 = r.body.match(/window\.__NEXT_DATA__\s*=\s*({[\s\S]*?});/);
      if (!match2) {
        console.log('No __NEXT_DATA__ found. Body length:', r.body.length);
        return res.status(400).json({ error: 'Could not parse Spotify embed page. Try again in a moment.' });
      }
    }

    let nextData;
    try {
      const jsonStr = (match || r.body.match(/window\.__NEXT_DATA__\s*=\s*({[\s\S]*?});/))[1];
      nextData = JSON.parse(jsonStr);
    } catch(e) {
      return res.status(400).json({ error: 'Failed to parse Spotify data: ' + e.message });
    }

    const state = nextData?.props?.pageProps?.state;
    const entity = state?.data?.entity || state?.entity;

    const tracks = [];

    if (entity?.trackList?.length) {
      for (const t of entity.trackList) {
        const name = t.title || t.name || '';
        const artist = t.subtitle || t.artists?.[0]?.name || '';
        if (name) tracks.push({ title: (name + (artist ? ' ' + artist : '')).trim() });
      }
    }

    if (!tracks.length && entity?.items?.length) {
      for (const item of entity.items) {
        const t = item.track || item;
        const name = t.name || t.title || '';
        const artist = t.artists?.[0]?.name || '';
        if (name) tracks.push({ title: (name + (artist ? ' ' + artist : '')).trim() });
      }
    }

    if (!tracks.length) {
      const stateStr = JSON.stringify(nextData);
      const trackListMatch = stateStr.match(/"trackList":\s*(\[(?:[^[\]]*|\[(?:[^[\]]*|\[[^\]]*\])*\])*\])/);
      if (trackListMatch) {
        try {
          const tl = JSON.parse(trackListMatch[1]);
          for (const t of tl) {
            const name = t.title || t.name || '';
            const artist = t.subtitle || '';
            if (name) tracks.push({ title: (name + (artist ? ' ' + artist : '')).trim() });
          }
        } catch(_) {}
      }
    }

    if (!tracks.length) {
      console.log('State keys:', Object.keys(state || {}));
      console.log('Entity keys:', Object.keys(entity || {}));
      return res.status(400).json({ error: 'No tracks found in Spotify embed. The playlist may be private or region-locked.' });
    }

    console.log(`✅ Got ${tracks.length} tracks from Spotify embed`);
    res.json({ tracks });

  } catch (err) {
    console.error('Spotify error:', err.message);
    res.status(500).json({ error: 'Failed to load playlist: ' + err.message });
  }
});

/* ── YouTube search ── */
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'No query provided.' });
  if (YT_API_KEY) {
    try {
      const r = await httpRequest(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`,
        { method: 'GET' }
      );
      const data = JSON.parse(r.body);
      if (data.items?.length)
        return res.json(data.items.map(item => ({ id: item.id.videoId, title: item.snippet.title })));
    } catch (err) {
      console.error('YouTube API error:', err.message);
    }
  }
  const ytDlpPath = getYtDlpPath();
  const ytdlp = spawn(ytDlpPath, [`ytsearch10:${query}`, '--get-id', '--get-title', '--skip-download', '--cookies', getCookiesPath()], { shell: false });
  let out = '';
  ytdlp.stdout.on('data', d => out += d.toString());
  ytdlp.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: 'Search failed' });
    const lines = out.trim().split('\n');
    const videos = [];
    for (let i = 0; i < lines.length; i += 2)
      if (lines[i] && lines[i + 1]) videos.push({ id: lines[i + 1].trim(), title: lines[i].trim() });
    res.json(videos);
  });
});

/* ── Stream (video) ── */
app.get('/stream', (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'Missing video ID.' });
  const ytDlpPath = getYtDlpPath();
  const ytdlp = spawn(ytDlpPath, ['-o', '-', '--cookies', getCookiesPath(), `https://www.youtube.com/watch?v=${videoId}`], { shell: false });
  res.setHeader('Content-Type', 'video/mp4');
  ytdlp.stdout.pipe(res);
  ytdlp.stderr.on('data', d => console.error('[yt-dlp stream]', d.toString()));
  ytdlp.on('error', () => { if (!res.headersSent) res.status(500).end(); });
});

/* ── Smart track resolver (Spotify → correct YouTube video) ── */
function resolveTrackId(ytDlpPath, songTitle) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(ytDlpPath, [
      `ytsearch5:${songTitle} official audio`,
      '--get-id', '--get-title', '--get-duration',
      '--skip-download', '--no-playlist',
      '--cookies', getCookiesPath()
    ], { shell: false });

    let out = '';
    ytdlp.stdout.on('data', d => out += d.toString());
    ytdlp.on('close', () => {
      const lines = out.trim().split('\n').filter(Boolean);
      const results = [];

      for (let i = 0; i + 2 < lines.length; i += 3) {
        results.push({
          title: lines[i].trim(),
          id: lines[i + 1].trim(),
          duration: parseInt(lines[i + 2]) || 999
        });
      }

      if (!results.length) return reject(new Error('No results found'));

      const scored = results.map(r => {
        const t = r.title.toLowerCase();
        let score = 0;
        if (t.includes('official audio'))  score += 10;
        if (t.includes('official video'))  score += 8;
        if (t.includes('official'))        score += 5;
        if (t.includes('audio'))           score += 3;
        if (t.includes('lyrics'))          score += 2;
        if (t.includes('cover'))           score -= 6;
        if (t.includes('reaction'))        score -= 8;
        if (t.includes('remix'))           score -= 4;
        if (t.includes('live'))            score -= 3;
        if (t.includes('karaoke'))         score -= 8;
        if (r.duration > 600)              score -= 8;
        if (r.duration < 60)               score -= 5;
        return { ...r, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      console.log(`🎯 Resolved "${songTitle}" → "${best.title}" (${best.id}, score: ${best.score})`);
      resolve(best.id);
    });

    ytdlp.on('error', reject);
  });
}

/* ── Download audio ── */
app.get('/download', async (req, res) => {
  let videoId = req.query.id;
  const title = req.query.title;
  if (!videoId) return res.status(400).json({ error: 'Missing video ID.' });

  const ytDlpPath = getYtDlpPath();
  const safeTitle = (title || 'audio').replace(/[^a-zA-Z0-9 \-_]/g, '').trim() || 'audio';

  if (videoId.includes(' ')) {
    console.log(`🔍 Resolving Spotify track: "${videoId}"`);
    try {
      videoId = await resolveTrackId(ytDlpPath, videoId);
    } catch (err) {
      console.error('Resolution failed:', err.message);
      return res.status(404).json({ error: `Could not find "${safeTitle}" on YouTube` });
    }
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`⬇ Downloading: "${safeTitle}" → ${videoUrl}`);

  function buildArgs(client, format, extraArgs = []) {
    return [
      '-f', format,
      '--no-playlist',
      '--no-part',
      '--cookies', getCookiesPath(),
      '--extractor-args', `youtube:player_client=${client}`,
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      '--retries', '2',
      '--fragment-retries', '2',
      ...extraArgs,
      '-o', '-',
      videoUrl
    ];
  }

  const attempts = [
    { args: buildArgs('tv_embedded', 'bestaudio[ext=m4a]/bestaudio'),                            ext: 'm4a', mime: 'audio/mp4',  label: 'tv_embedded' },
    { args: buildArgs('ios',         'bestaudio[ext=m4a]/bestaudio'),                            ext: 'm4a', mime: 'audio/mp4',  label: 'ios'         },
    { args: buildArgs('android',     'bestaudio'),                                                ext: 'm4a', mime: 'audio/mp4',  label: 'android'     },
    { args: buildArgs('web',         'bestaudio', ['--extract-audio', '--audio-format', 'mp3']), ext: 'mp3', mime: 'audio/mpeg', label: 'web/mp3'      },
  ];

  let attemptIndex = 0;

  function tryNext() {
    if (attemptIndex >= attempts.length) {
      console.error(`✗ All attempts failed for: ${safeTitle}`);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed. Please try again.' });
      return;
    }

    const attempt = attempts[attemptIndex++];
    console.log(`  → Trying ${attempt.label}...`);

    const ytdlp = spawn(ytDlpPath, attempt.args, { shell: false });
    let hasData = false;
    let headersSent = false;

    ytdlp.stderr.on('data', d => {
      const line = d.toString();
      if (line.toLowerCase().includes('error') && !line.includes('Retrying'))
        console.error(`[${attempt.label}]`, line.trim());
    });

    ytdlp.stdout.on('data', chunk => {
      if (!headersSent) {
        headersSent = true;
        res.setHeader('Content-Type', attempt.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.${attempt.ext}"`);
      }
      hasData = true;
      res.write(chunk);
    });

    ytdlp.on('close', code => {
      if (hasData) { console.log(`  ✓ Success with ${attempt.label}`); res.end(); return; }
      console.warn(`  ✗ ${attempt.label} produced no data, trying next...`);
      tryNext();
    });

    ytdlp.on('error', err => { console.error('spawn error:', err.message); tryNext(); });
    req.on('close', () => { try { ytdlp.kill('SIGTERM'); } catch (_) {} });
  }

  tryNext();
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music Verse on http://localhost:${PORT}`);
});
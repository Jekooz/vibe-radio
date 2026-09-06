const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ICECAST_URL = 'http://localhost:8000';
const PLAYLIST_DIR = '/opt/radio/queue';
const REQUESTS_DIR = '/opt/radio/requests';
const DOWNLOAD_SCRIPT = '/opt/radio/scripts/download.py';

let connectedClients = new Set();
let currentTrack = { title: 'Loading...', artist: 'Vibe Radio' };

// ─── Helper: get Icecast stats ─────────────────────────────
async function getIcecastStats() {
  try {
    const response = await fetch(`${ICECAST_URL}/status.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

// ─── Helper: parse Icecast status for current track ────────
async function getNowPlaying() {
  try {
    const response = await fetch(`${ICECAST_URL}/status.json`);
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    const data = await response.json();

    // Icecast returns: source -> title, artist
    const source = data?.source;
    if (source && source.title) {
      return {
        title: source.title || 'Unknown Track',
        artist: source.artist || 'Vibe Radio',
        stream: source.stream_name || 'Vibe Radio'
      };
    }
  } catch (error) {
    console.error('Error fetching now playing:', error);
  }
  return currentTrack;
}

// ─── Poll Icecast for track changes ────────────────────────
setInterval(async () => {
  const track = await getNowPlaying();
  if (track.title !== currentTrack.title || track.artist !== currentTrack.artist) {
    currentTrack = track;
    io.emit('nowPlaying', currentTrack);
  }
}, 3000);

// ─── Helper: read playlist file ─────────────────────────────
function readPlaylist(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(filePath => {
      const fileName = path.basename(filePath);
      const match = fileName.match(/^(.+?) - (.+?) \[[0-9a-f]{8}\]\.mp3$/i);
      if (match) {
        return {
          file: filePath,
          title: match[2],
          artist: match[1]
        };
      }
      return {
        file: filePath,
        title: fileName.replace(/\.[^/.]+$/, ""),
        artist: 'Unknown'
      };
    });
}

// ─── Helper: read requests ─────────────────────────────────
function getRequests() {
  return readPlaylist(path.join(REQUESTS_DIR, 'requests.m3u'));
}

// ─── Helper: read queue playlist ───────────────────────────
function getPlaylist() {
  return readPlaylist(path.join(PLAYLIST_DIR, 'queue.m3u'));
}

// ─── REST API Endpoints ────────────────────────────────────

app.get('/api/nowplaying', (req, res) => {
  res.json(currentTrack);
});

app.get('/api/playlist', (req, res) => {
  res.json(getPlaylist());
});

app.get('/api/requests', (req, res) => {
  res.json(getRequests());
});

app.post('/api/request', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate YouTube URL
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  // Trigger the download script asynchronously
  const downloadProcess = exec(
    `python3 ${DOWNLOAD_SCRIPT} "${url}" --requests`,
    (error, stdout, stderr) => {
      if (error) {
        console.error('Download error:', error);
        console.error('stderr:', stderr);
        return;
      }
      console.log('Download completed:', stdout.trim());
    }
  );

  // Notify all clients
  io.emit('newRequest', { url, timestamp: Date.now() });

  res.json({ success: true, message: 'Request received! Downloading now...' });
});

app.get('/api/stats', async (req, res) => {
  const stats = await getIcecastStats();
  if (stats) {
    res.json({
      listeners: stats?.listeners || 0,
      max_listeners: stats?.max_listeners || 0,
      stream: stats?.source?.stream_name || 'Vibe Radio'
    });
  } else {
    res.status(500).json({ error: 'Could not fetch stats' });
  }
});

// ─── Socket.io Connection Handling ─────────────────────────
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  connectedClients.add(socket.id);

  // Send current state to newly connected client
  socket.emit('nowPlaying', currentTrack);
  socket.emit('playlist', getPlaylist());
  socket.emit('requests', getRequests());
  socket.emit('clientCount', connectedClients.size);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedClients.delete(socket.id);
    io.emit('clientCount', connectedClients.size);
  });

  socket.on('approveRequest', (data) => {
    console.log('Request approved:', data);
    io.emit('requestApproved', data);
  });

  // Chat message handler
  socket.on('chatMessage', (data) => {
    console.log('Chat:', data.username, ':', data.message);
    io.emit('chatMessage', data);
  });
});

// ─── Start Server ──────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the radio interface`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
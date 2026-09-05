const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

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

// Store connected clients
let connectedClients = new Set();

// Store current track info
let currentTrack = { title: 'Loading...', artist: 'Vibe Radio' };

// Store requests
let songRequests = [];

// Fetch now playing from Icecast stats
async function getNowPlaying() {
  try {
    const response = await fetch(`${ICECAST_URL}/status-json.xsl`);
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    const data = await response.text();

    // Parse XML-like response (Icecast status-json is actually XML)
    const titleMatch = data.match(/<source[^>]*>.*?<title>([^<]+)<\/title>.*?<\/source>/s);
    const artistMatch = data.match(/<source[^>]*>.*?<artist>([^<]+)<\/artist>.*?<\/source>/s);

    if (titleMatch && artistMatch) {
      return {
        title: titleMatch[1] || 'Unknown Track',
        artist: artistMatch[1] || 'Unknown Artist'
      };
    }
  } catch (error) {
    console.error('Error fetching now playing:', error);
  }
  return currentTrack; // Return last known on error
}

// Update now playing periodically
setInterval(async () => {
  const track = await getNowPlaying();
  if (track.title !== currentTrack.title || track.artist !== currentTrack.artist) {
    currentTrack = track;
    io.emit('nowPlaying', currentTrack);
  }
}, 5000); // Every 5 seconds

// Get playlist
function getPlaylist() {
  const playlistPath = path.join(PLAYLIST_DIR, 'queue.m3u');
  if (!fs.existsSync(playlistPath)) return [];

  const content = fs.readFileSync(playlistPath, 'utf8');
  return content.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(filePath => {
      const fileName = path.basename(filePath);
      // Try to parse artist - title from filename
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

// Get requests
function getRequests() {
  const requestsPath = path.join(REQUESTS_DIR, 'requests.m3u');
  if (!fs.existsSync(requestsPath)) return [];

  const content = fs.readFileSync(requestsPath, 'utf8');
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

// REST API endpoints
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

  // Add to requests queue (in a real app, you'd have an approval system)
  songRequests.push({ url, timestamp: Date.now() });
  io.emit('newRequest', { url, timestamp: Date.now() });

  res.json({ success: true, message: 'Request received' });
});

app.get('/api/stats', async (req, res) => {
  try {
    const response = await fetch(`${ICECAST_URL}/status.json`);
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Could not fetch stats' });
  }
});

// Socket.io connection handling
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
    // In a real implementation, this would trigger the download script
    console.log('Request approved:', data);
    io.emit('requestApproved', data);
  });
});

// Start server
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
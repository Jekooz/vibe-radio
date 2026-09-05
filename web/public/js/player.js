// ─── Initialize Socket.io Connection ────────────────────
const socket = io();

const audioElement = document.getElementById('radio-stream');
const playBtn = document.getElementById('play-btn');
const volumeSlider = document.getElementById('volume-slider');
const volumeLabel = document.getElementById('volume-label');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const listenerCount = document.getElementById('listener-count');
const playlistContainer = document.getElementById('playlist-container');
const requestsContainer = document.getElementById('requests-container');
const requestUrlInput = document.getElementById('request-url');
const submitRequestBtn = document.getElementById('submit-request');
const requestStatusDiv = document.getElementById('request-status');

let isPlaying = false;

// ─── Play/Pause Button ───────────────────────────────────
playBtn.addEventListener('click', () => {
  if (isPlaying) {
    audioElement.pause();
    playBtn.textContent = '▶ Play';
    isPlaying = false;
  } else {
    audioElement.play().catch(err => {
      console.error('Error playing audio:', err);
      showStatus('Could not connect to stream', 'error');
    });
    playBtn.textContent = '⏸ Pause';
    isPlaying = true;
  }
});

audioElement.addEventListener('play', () => {
  isPlaying = true;
  playBtn.textContent = '⏸ Pause';
});

audioElement.addEventListener('pause', () => {
  isPlaying = false;
  playBtn.textContent = '▶ Play';
});

// ─── Volume Control ──────────────────────────────────────
volumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value;
  audioElement.volume = volume / 100;
  volumeLabel.textContent = volume + '%';
});

// Set initial volume
audioElement.volume = volumeSlider.value / 100;

// ─── Now Playing Updates ────────────────────────────────
socket.on('nowPlaying', (track) => {
  trackTitle.textContent = track.title || 'Unknown Track';
  trackArtist.textContent = track.artist || 'Vibe Radio';
});

// ─── Playlist Updates ────────────────────────────────────
socket.on('playlist', (playlist) => {
  updatePlaylist(playlist);
});

function updatePlaylist(playlist) {
  if (!playlist || playlist.length === 0) {
    playlistContainer.innerHTML = '<p class="empty">No tracks in queue</p>';
    return;
  }

  playlistContainer.innerHTML = playlist.map((track, index) => `
    <div class="list-item ${index === 0 ? 'playing' : ''}">
      <div class="item-info">
        <h4>${track.title}</h4>
        <p>${track.artist}</p>
      </div>
      <div class="item-actions">
        <button class="btn-small" onclick="removeTrack('${track.file}')">Remove</button>
      </div>
    </div>
  `).join('');
}

// ─── Requests ───────────────────────────────────────────
socket.on('requests', (requests) => {
  updateRequests(requests);
});

function updateRequests(requests) {
  if (!requests || requests.length === 0) {
    requestsContainer.innerHTML = '<p class="empty">No pending requests</p>';
    return;
  }

  requestsContainer.innerHTML = requests.map((track) => `
    <div class="list-item">
      <div class="item-info">
        <h4>${track.title}</h4>
        <p>${track.artist}</p>
      </div>
      <div class="item-actions">
        <button class="btn-small" onclick="approveRequest('${track.file}')">Approve</button>
        <button class="btn-small" onclick="rejectRequest('${track.file}')">Reject</button>
      </div>
    </div>
  `).join('');
}

socket.on('newRequest', (data) => {
  console.log('New request received:', data);
  fetchRequests();
});

// ─── Submit Song Request ────────────────────────────────
submitRequestBtn.addEventListener('click', async () => {
  const url = requestUrlInput.value.trim();
  if (!url) {
    showStatus('Please enter a YouTube URL', 'error');
    return;
  }

  submitRequestBtn.disabled = true;
  submitRequestBtn.textContent = 'Submitting...';

  try {
    const response = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (response.ok) {
      showStatus('Request submitted! 🎉', 'success');
      requestUrlInput.value = '';
      fetchRequests();
    } else {
      showStatus(data.error || 'Failed to submit request', 'error');
    }
  } catch (error) {
    console.error('Error submitting request:', error);
    showStatus('Network error', 'error');
  } finally {
    submitRequestBtn.disabled = false;
    submitRequestBtn.textContent = 'Submit Request';
  }
});

function showStatus(message, type) {
  requestStatusDiv.textContent = message;
  requestStatusDiv.className = `status-message show ${type}`;
  setTimeout(() => {
    requestStatusDiv.classList.remove('show');
  }, 4000);
}

// ─── Listener Count ─────────────────────────────────────
socket.on('clientCount', (count) => {
  listenerCount.textContent = count + ' listener' + (count !== 1 ? 's' : '');
});

// ─── Fetch Functions ────────────────────────────────────
async function fetchPlaylist() {
  try {
    const response = await fetch('/api/playlist');
    const playlist = await response.json();
    updatePlaylist(playlist);
  } catch (error) {
    console.error('Error fetching playlist:', error);
  }
}

async function fetchRequests() {
  try {
    const response = await fetch('/api/requests');
    const requests = await response.json();
    updateRequests(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
  }
}

// ─── Playlist Management ────────────────────────────────
function removeTrack(file) {
  console.log('Remove track:', file);
  // In a real implementation, send this to the server
}

function approveRequest(file) {
  console.log('Approve request:', file);
  socket.emit('approveRequest', { file });
}

function rejectRequest(file) {
  console.log('Reject request:', file);
  // In a real implementation, delete from requests queue
}

// ─── Tab Switching ──────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;

    // Remove active class from all buttons and tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    // Add active class to clicked button and corresponding tab
    btn.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
  });
});

// ─── Initial Load ───────────────────────────────────────
fetchPlaylist();
fetchRequests();

// Auto-refresh playlist every 10 seconds
setInterval(fetchPlaylist, 10000);
setInterval(fetchRequests, 10000);
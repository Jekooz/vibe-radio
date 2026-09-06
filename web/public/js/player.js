// ═══ Vibe Radio Player JS ════════════════════════
const socket = io();
const stream    = document.getElementById('stream');
const playBtn   = document.getElementById('play-btn');
const vol       = document.getElementById('vol');
const listeners = document.getElementById('listeners');
const npTitle   = document.getElementById('np-title');
const npArtist  = document.getElementById('np-artist');
const queueList = document.getElementById('queue-list');
const iconPlay  = playBtn.querySelector('.icon-play');
const iconPause = playBtn.querySelector('.icon-pause');

// ── Play / Pause ────────────────────────────────────
playBtn.addEventListener('click', () => {
  if (stream.paused) {
    stream.play().catch(() => {});
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    stream.pause();
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }
});

stream.addEventListener('play', () => { iconPlay.style.display='none'; iconPause.style.display='block'; });
stream.addEventListener('pause', () => { iconPlay.style.display='block'; iconPause.style.display='none'; });

vol.addEventListener('input', () => { stream.volume = vol.value / 100; });
stream.volume = vol.value / 100;

// ── Now Playing ──────────────────────────────────────
socket.on('nowPlaying', (track) => {
  npTitle.textContent  = track.title || '—';
  npArtist.textContent = track.artist || 'Vibe Radio';
});

// ── Playlist / Queue ─────────────────────────────────
socket.on('playlist', (playlist) => {
  if (!playlist || !playlist.length) {
    queueList.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;padding:6px 0;">No tracks in queue</div>';
    return;
  }
  queueList.innerHTML = playlist.map((t, i) => `
    <div class="queue-row">
      <span class="queue-num">${i + 1}</span>
      <span class="queue-title">${esc(t.title)}</span>
      <span class="queue-art">${esc(t.artist)}</span>
    </div>
  `).join('');
});

// ── Listener count ───────────────────────────────────
socket.on('clientCount', (n) => { listeners.textContent = n + ' online'; });

// ── Helper ────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────
socket.emit('requestStatus', { action: 'init' });

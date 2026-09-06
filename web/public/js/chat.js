const socketC = io();
const chatEl  = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let chatName = localStorage.getItem('vibe-name') || 'Guest' + Math.floor(Math.random()*999);
localStorage.setItem('vibe-name', chatName);

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  socketC.emit('chatMessage', { username: chatName, message: msg, timestamp: new Date().toLocaleTimeString() });
  chatInput.value = '';
});

socketC.on('chatMessage', (data) => {
  const d = document.createElement('div');
  d.style.cssText = 'padding:5px 6px;margin:4px 0;background:rgba(255,255,255,0.05);border-radius:8px;';
  d.innerHTML = '<span style="color:#e8bf70;font-weight:600;font-size:0.75rem;display:block;">' + esc(data.username) + '</span>'
              + '<span style="color:#f3e6f7;font-size:0.82rem;">' + esc(data.message) + '</span>';
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
  chatEl.style.display = 'block';
});

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

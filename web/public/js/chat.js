// ─── Chat Functionality ─────────────────────────────────
const socket = io();
const chatMessages = document.getElementById('chat-messages');
const chatMessageInput = document.getElementById('chat-message');
const sendChatBtn = document.getElementById('send-chat');

let username = localStorage.getItem('username') || 'Anonymous' + Math.floor(Math.random() * 1000);

// Save username to localStorage
localStorage.setItem('username', username);

// ─── Send Chat Message ──────────────────────────────────
function sendMessage() {
  const message = chatMessageInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    username,
    message,
    timestamp: new Date().toLocaleTimeString()
  });

  chatMessageInput.value = '';
  chatMessageInput.focus();
}

sendChatBtn.addEventListener('click', sendMessage);
chatMessageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// ─── Receive Chat Messages ──────────────────────────────
socket.on('chatMessage', (data) => {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.innerHTML = `
    <div class="message-user">${escapeHtml(data.username)} <span style="font-weight: 400; color: var(--text-dim);">${data.timestamp}</span></div>
    <div class="message-text">${escapeHtml(data.message)}</div>
  `;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('userJoined', (data) => {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message system';
  messageEl.textContent = `${data.username} joined the chat`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('userLeft', (data) => {
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message system';
  messageEl.textContent = `${data.username} left the chat`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ─── Utility Functions ──────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Announce user join
socket.emit('userJoined', { username });
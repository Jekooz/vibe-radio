# Vibe Radio 🎵

A lightweight, self-hosted web radio streaming platform powered by Icecast, Liquidsoap, and yt-dlp.

## Features

- **YouTube Integration**: Stream any song from YouTube via yt-dlp
- **Live Streaming**: Icecast2 for reliable audio streaming
- **Playlist Automation**: Liquidsoap handles crossfading and queue management
- **Web Interface**: Modern, responsive player with:
  - Now Playing display
  - Playlist management
  - Song request system
  - Live chat
- **Low Resource Usage**: Runs smoothly on 2-4 cores, 2GB RAM

## Architecture

```
yt-dlp (downloads) → Liquidsoap (automation) → Icecast2 (streaming)
                                                    ↓
                                          Web Application (player)
```

## Quick Start

### 1. Clone the Repository

On your VPS:
```bash
git clone https://github.com/Jekooz/vibe-radio.git /opt/radio
cd /opt/radio
```

### 2. Run Setup Script

```bash
sudo bash setup.sh
```

### 3. Remove AzuraCast (if installed)

```bash
cd /var/azuracast
docker-compose down
```

### 4. Start Services

```bash
sudo systemctl enable icecast2
sudo systemctl start icecast2

sudo systemctl enable vibe-radio
sudo systemctl start vibe-radio

sudo systemctl enable vibe-radio-web
sudo systemctl start vibe-radio-web
```

### 5. Access the Web Interface

Open your browser and visit:
```
http://YOUR_VPS_IP:3000
```

## Directory Structure

```
/opt/radio/
├── radio.liq           # Liquidsoap configuration
├── queue/              # Downloaded songs (main playlist)
│   └── queue.m3u       # Playlist file
├── requests/           # Song requests
│   └── requests.m3u    # Requests playlist
├── scripts/
│   ├── download.py     # yt-dlp wrapper script
│   └── update-nowplaying.sh
├── logs/
└── web/                # Web application
    ├── server.js
    ├── package.json
    └── public/
        ├── index.html
        ├── css/style.css
        └── js/
            ├── player.js
            └── chat.js
```

## Configuration

### Icecast2 (`/etc/icecast2/icecast.xml`)

Default passwords (change these!):
- Source password: `hackme-source`
- Admin password: `hackme-admin`

### Liquidsoap (`/opt/radio/radio.liq`)

- Modify crossfade duration
- Add additional audio processing
- Configure live input port

### Web App (`/opt/radio/web/server.js`)

- Change port (default: 3000)
- Modify API endpoints
- Add authentication

## Adding Songs

### Via Command Line

```bash
# Add to main queue
python3 /opt/radio/scripts/download.py "https://youtube.com/watch?v=..."

# Add to requests (higher priority)
python3 /opt/radio/scripts/download.py "https://youtube.com/watch?v=..." --requests
```

### Via Web Interface

1. Open the web interface
2. Go to the "Requests" tab
3. Paste a YouTube URL
4. Click "Submit Request"

## Live Broadcasting

Connect your broadcasting software (BUTT, Mixxx, etc.) to:
- **Server**: `your-vps-ip:8001`
- **Mount**: `/live`
- **Password**: `hackme-source`

When live, Liquidsoap automatically switches from the playlist to your live stream.

## Service Management

```bash
# Check status
sudo systemctl status vibe-radio
sudo systemctl status vibe-radio-web
sudo systemctl status icecast2

# View logs
sudo journalctl -u vibe-radio -f
sudo journalctl -u vibe-radio-web -f
sudo tail -f /var/log/icecast2/error.log

# Restart services
sudo systemctl restart vibe-radio
sudo systemctl restart vibe-radio-web
```

## Firewall Setup

Allow required ports:
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 8000/tcp    # Icecast
sudo ufw allow 3000/tcp    # Web interface
sudo ufw allow 8001/tcp    # Live input (optional)
sudo ufw enable
```

## Performance Notes

Resource usage on a 2-core VPS:
- Icecast: ~50MB RAM
- Liquidsoap: ~100-150MB RAM
- Web App: ~100-150MB RAM
- **Total**: ~300-400MB RAM

## Troubleshooting

### Stream not playing?
1. Check if Icecast is running: `sudo systemctl status icecast2`
2. Check if Liquidsoap is running: `sudo systemctl status vibe-radio`
3. Verify Icecast is streaming: `curl http://localhost:8000/status.xsl`

### Can't download songs?
1. Check yt-dlp is installed: `yt-dlp --version`
2. Update yt-dlp: `pip3 install --upgrade yt-dlp`

### Web interface not loading?
1. Check if web app is running: `sudo systemctl status vibe-radio-web`
2. Check logs: `sudo journalctl -u vibe-radio-web -f`
3. Verify port is open: `sudo netstat -tulpn | grep 3000`

## License

MIT

## Credits

Built with:
- [Icecast2](https://icecast.org/)
- [Liquidsoap](https://www.liquidsoap.info/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Node.js](https://nodejs.org/)
- [Socket.io](https://socket.io/)
#!/bin/bash
# Vibe Radio Setup Script
# Run as: sudo bash setup.sh

set -e

echo "========================================"
echo "  Vibe Radio Setup"
echo "========================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash setup.sh"
  exit 1
fi

echo "[1/8] Updating system..."
apt update && apt upgrade -y

echo "[2/8] Installing dependencies..."
apt install -y icecast2 liquidsoap ffmpeg python3 python3-pip git curl nodejs npm

echo "[3/8] Installing yt-dlp..."
# Download latest yt-dlp standalone binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

echo "[4/8] Creating directory structure..."
mkdir -p /opt/radio/{queue,requests,playlists,logs,scripts}
mkdir -p /var/log/liquidsoap
cp -r scripts/* /opt/radio/scripts/ 2>/dev/null || true
cp -r web /opt/radio/ 2>/dev/null || true
cp -r liquidsoap/* /opt/radio/ 2>/dev/null || true

# Set permissions (allow liquidsoap to write)
chown -R ubuntu:ubuntu /opt/radio 2>/dev/null || true
chmod -R 755 /opt/radio

echo "[5/8] Configuring Icecast2..."
# Backup original config
cp /etc/icecast2/icecast.xml /etc/icecast2/icecast.xml.bak 2>/dev/null || true

# Create custom config
cat > /etc/icecast2/icecast.xml << 'EOF'
<icecast>
  <location>Vibe Radio</location>
  <admin>admin@vibe.radio</admin>

  <limits>
    <clients>100</clients>
    <sources>3</sources>
    <queue-size>524288</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>65535</burst-size>
  </limits>

  <authentication>
    <source-password>hackme-source</source-password>
    <relay-password>hackme-relay</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>hackme-admin</admin-password>
  </authentication>

  <hostname>0.0.0.0</hostname>
  <listen-socket>
    <port>8000</port>
    <bind-address>0.0.0.0</bind-address>
  </listen-socket>

  <mount type="normal">
    <mount-name>/radio</mount-name>
    <username>source</username>
    <password>hackme-source</password>
    <max-listeners>100</max-listeners>
    <public>1</public>
    <stream-name>Vibe Radio</stream-name>
    <stream-description>Non-stop vibes — powered by yt-dlp + liquidsoap</stream-description>
    <genre>Varied</genre>
    <bitrate>192</bitrate>
    <type>audio/mpeg</type>
  </mount>

  <mount type="normal">
    <mount-name>/live</mount-name>
    <username>source</username>
    <password>hackme-source</password>
    <max-listeners>10</max-listeners>
    <public>0</public>
    <hidden>0</hidden>
  </mount>

  <fileserve>1</fileserve>

  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
    <alias source="/" destination="/status.xsl"/>
  </paths>

  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>3</loglevel>
    <logsize>10000</logsize>
  </logging>

  <security>
    <chroot>0</chroot>
  </security>
</icecast>
EOF

echo "[6/8] Setting up Liquidsoap..."
# Copy liquidsoap script
cp liquidsoap/radio.liq /opt/radio/radio.liq
chmod 644 /opt/radio/radio.liq

# Create now-playing update script
cat > /opt/radio/scripts/update-nowplaying.sh << 'EOF'
#!/bin/bash
TITLE="$1"
ARTIST="$2"
echo "{\"title\":\"$TITLE\",\"artist\":\"$ARTIST\"}" > /opt/radio/nowplaying.json
EOF
chmod +x /opt/radio/scripts/update-nowplaying.sh

echo "[7/8] Setting up Web Application..."
cd /opt/radio/web
npm install

echo "[8/8] Creating service files..."

# Create systemd service for liquidsoap
cat > /etc/systemd/system/vibe-radio.service << 'EOF'
[Unit]
Description=Vibe Radio - Liquidsoap Streaming
After=network.target icecast2.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/radio
ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for web app
cat > /etc/systemd/system/vibe-radio-web.service << 'EOF'
[Unit]
Description=Vibe Radio - Web Interface
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/radio/web
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Stop AzuraCast: cd /var/azuracast && docker-compose down"
echo ""
echo "2. Start services:"
echo "   systemctl enable icecast2"
echo "   systemctl start icecast2"
echo "   systemctl enable vibe-radio"
echo "   systemctl start vibe-radio"
echo "   systemctl enable vibe-radio-web"
echo "   systemctl start vibe-radio-web"
echo ""
echo "3. Visit: http://YOUR_VPS_IP:3000"
echo ""
echo "4. Default passwords (change in /etc/icecast2/icecast.xml):"
echo "   - Source password: hackme-source"
echo "   - Admin password: hackme-admin"
echo ""
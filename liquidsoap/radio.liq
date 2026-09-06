# ─── Vibe Radio — Liquidsoap ────────────────────────────────

settings.log.file := true
settings.log.file.path := "/var/log/liquidsoap/vibe.log"
settings.init.allow_root := true

icecast_host     = "localhost"
icecast_port     = 8000
icecast_password = "hackme-source"

# ── helper: replaygain normalize ────
def radio_track(s)
  s = replaygain(s)
  s
end

# ── Playlists ───────────────────────────────────────────────
# Requests (high priority)
requests = playlist(
  id="requests",
  mode="normal",
  reload_mode="watch",
  reload=30,
  "/opt/radio/requests/requests.m3u"
)

# Main queue
queue = playlist(
  id="queue",
  mode="normal",
  reload_mode="watch",
  reload=30,
  "/opt/radio/queue/queue.m3u"
)

# ── Live DJ source (e.g. BUTT / Mixxx can connect to /live) ────
live = input.harbor(
  id="live",
  port=8001,
  mount="/live",
  password="hackme-source",
  max=30.,
  buffer=5.
)

# ── Fallback logic ──────────────────────────────────────────
# Priority: live  >  requests  >  queue  >  silence
radio = fallback(track_sensitive=false, [
  live,
  requests,
  queue
])

radio = radio_track(radio)

# ── Crossfade ───────────────────────────────────────────────
radio = crossfade(duration=3., radio)

# ── Metadata callback for now-playing ───────────────────────
def on_track(m) =
  title  = m["title"]
  artist = m["artist"]
  if title == "" then
    title = m["filename"]
  end
  # Write to file for web app to pick up
  json = '{"title":"#{string.replace(pattern="'", fun(s)->"\\'")(title)}","artist":"#{string.replace(pattern="'", fun(s)->"\\'")(artist)}"}'
  _ = process.run("echo '#{json}' > /opt/radio/nowplaying.json")
  ()
end

radio.on_metadata(on_track)

# ── Output to Icecast ───────────────────────────────────────
output.icecast(
  %mp3(bitrate=192, samplerate=44100, stereo=true),
  host=icecast_host, port=icecast_port,
  password=icecast_password, mount="/radio",
  name="Vibe Radio",
  description="Vibe Radio — 24/7",
  genre="Varied",
  url="http://localhost:8000/radio",
  radio
)

# ── Telnet server for debugging ─────────────────────────────
settings.server.telnet := true
settings.server.telnet.port := 1234
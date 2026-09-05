# ─── Vibe Radio — Liquidsoap ────────────────────────────────

settings.log.file := true
settings.log.file.path := "/var/log/liquidsoap/vibe.log"
settings.init.allow_root := true

icecast_host     = "localhost"
icecast_port     = 8000
icecast_password = "hackme-source"

# ── helper: single_replaygain (normalise volume lightly) ────
def radio_track(s)
  s = replaygain(s)
  s
end

# ── playlist from local files ───────────────────────────────
#  The web app downloads yt-dlp tracks into /opt/radio/queue/
playlist_dir = "/opt/radio/queue"

#  Requests are staged into /opt/radio/requests/ — highest priority
requests = playlist(
  id="requests",
  mode="normal",
  reload_mode="watch",
  "/opt/radio/requests/requests.m3u"
)

#  Regular queue
queue = playlist(
  id="queue",
  mode="normal",
  reload_mode="watch",
  "/opt/radio/queue/queue.m3u"
)

#  Live DJ source (e.g. BUTT / Mixxx can connect to /live)
live = input.harbor(
  id="live",
  port=8001,
  mount="/live",
  password="hackme-source",
  max=30.,
  buffer=5.
)

# ── fallback logic ──────────────────────────────────────────
#  Priority: live  >  requests  >  queue  >  silence fallback
radio = fallback(track_sensitive=false, [
  live,
  requests,
  queue
])

radio = radio_track(radio)

# ── crossfade ───────────────────────────────────────────────
radio = crossfade(duration=3., radio)

# ── metadata / now-playing callback ────────────────────────
#  Writes current track to a JSON file the web app polls.
def on_track(m) =
  title  = m["title"]
  artist = m["artist"]
  if title == "" then
    title = m["filename"]
  end
  json = '{"title":"#{title}","artist":"#{artist}"}'
  _ = process.run("/opt/radio/scripts/update-nowplaying.sh '#{string.replace(pattern="'", fun(s)->"\\'")(title)}' '#{string.replace(pattern="'", fun(s)->"\\'")(artist)}'")
  ()
end

radio.on_metadata(on_track)

# ── output to Icecast ───────────────────────────────────────
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

# ── telnet server (handy for debugging) ─────────────────────
settings.server.telnet := true
settings.server.telnet.port := 1234

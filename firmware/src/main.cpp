// Garage door opener - standalone ESP32 controller.
//
//   phone --> https://ntfy.sh/<CMD_TOPIC>  --(this device holds a GET stream)-->  relay pulse
//   phone --> http://garage.local/open     (same signed payload, LAN, works with internet down)
//
// Wire format (ntfy message body, or POST body on /open):
//
//   v1;<ts>;<name>;<sighex>
//
//     ts      unix seconds
//     name    roster name, 1..31 chars, no ';' or ':'
//     sighex  lowercase hex of HMAC-SHA256(key = utf8(k), msg = "v1:<ts>:<name>")
//             k = the person's 64-hex key (from `make invite`). The HMAC key is
//             the 64 ASCII bytes of that hex string (portable across every
//             client). Only k is stored - here and in the clients. See
//             docs/protocol.md.
//
// Accept rules: known name, |now-ts| <= FRESHNESS_WINDOW_S, ts strictly greater
// than the last accepted ts for that user, HMAC matches, under the flood cap.
//
// Pinned to arduino-esp32 2.0.17 (platform-espressif32 6.9.0). See platformio.ini.

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <time.h>
#include "esp_task_wdt.h"
#include "mbedtls/md.h"

#include "config.h"
#include "certs.h"

#define MAX_ROSTER 32
#define WDT_TIMEOUT_S 30

// --------------------------------------------------------------------------
// Roster helpers
// --------------------------------------------------------------------------
static int rosterCount() { return (int)(sizeof(ROSTER) / sizeof(ROSTER[0])); }

static int rosterIndex(const String &name) {
  for (int i = 0; i < rosterCount(); i++)
    if (name == ROSTER[i].name) return i;
  return -1;
}

// Survives soft reset / brown-out recovery but not a full power cycle. The
// freshness window is the real replay guard; this just tightens it.
RTC_DATA_ATTR uint32_t lastTs[MAX_ROSTER];

// --------------------------------------------------------------------------
// Small utilities
// --------------------------------------------------------------------------
static void bytesToHex(const uint8_t *b, size_t n, char *out) {
  static const char *H = "0123456789abcdef";
  for (size_t i = 0; i < n; i++) {
    out[2 * i] = H[b[i] >> 4];
    out[2 * i + 1] = H[b[i] & 0x0f];
  }
  out[2 * n] = 0;
}

static void hmacSha256(const uint8_t *key, size_t keyLen, const uint8_t *msg,
                       size_t msgLen, uint8_t out[32]) {
  const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, info, 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, msg, msgLen);
  mbedtls_md_hmac_finish(&ctx, out);
  mbedtls_md_free(&ctx);
}

// constant-time; `mine` is our lowercase hex, `other` is untrusted (any case)
static bool constTimeHexEqual(const char *mine, const char *other) {
  size_t la = strlen(mine), lb = strlen(other);
  if (la != lb) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < la; i++) {
    char o = other[i];
    if (o >= 'A' && o <= 'F') o = o - 'A' + 'a';
    diff |= (uint8_t)(mine[i] ^ o);
  }
  return diff == 0;
}

// --------------------------------------------------------------------------
// Relay + door sensor
// --------------------------------------------------------------------------
static void relayWrite(bool active) {
  bool level = RELAY_ACTIVE_HIGH ? active : !active;
  digitalWrite(RELAY_GPIO, level ? HIGH : LOW);
}

static const char *doorState() {
#if SENSOR_GPIO < 0
  return "unknown";
#else
  int v = digitalRead(SENSOR_GPIO);
  bool open = SENSOR_OPEN_WHEN_HIGH ? (v == HIGH) : (v == LOW);
  return open ? "open" : "closed";
#endif
}

// flood guard: rolling count of actuations in the last 60 s
static unsigned long actTimes[MAX_OPENS_PER_MIN] = {0};
static int actHead = 0;

static bool floodOk() {
  unsigned long now = millis();
  int count = 0;
  for (int i = 0; i < MAX_OPENS_PER_MIN; i++)
    if (actTimes[i] != 0 && now - actTimes[i] < 60000UL) count++;
  return count < MAX_OPENS_PER_MIN;
}

static void floodRecord() {
  unsigned long t = millis();
  actTimes[actHead] = t ? t : 1;
  actHead = (actHead + 1) % MAX_OPENS_PER_MIN;
}

// --------------------------------------------------------------------------
// ntfy publish (log line). Short-lived connection, best effort.
// --------------------------------------------------------------------------
static void postLog(const String &name) {
  WiFiClientSecure c;
  c.setCACert(NTFY_ROOT_CA_BUNDLE);
  c.setTimeout(4);
  esp_task_wdt_reset();  // TLS handshake below blocks; give it a fresh window
  if (!c.connect(NTFY_HOST, NTFY_PORT)) {
    Serial.println("[log] connect failed");
    return;
  }
  esp_task_wdt_reset();
  char tbuf[32] = "??";
  time_t now = time(nullptr);
  struct tm tmv;
  if (localtime_r(&now, &tmv)) strftime(tbuf, sizeof(tbuf), "%Y-%m-%d %H:%M", &tmv);

  // "<name> opened the garage @ <time> — door now <state>"
  String body = name + " opened the garage @ " + tbuf +
                " \xE2\x80\x94 door now " + doorState();

  String req = String("POST /") + LOG_TOPIC + " HTTP/1.1\r\n" +
               "Host: " + NTFY_HOST + "\r\n" +
               "User-Agent: garage-esp32\r\n" +
               "Title: garage\r\n" +
               "Content-Type: text/plain; charset=utf-8\r\n" +
               "Content-Length: " + body.length() + "\r\n" +
               "Connection: close\r\n\r\n" + body;
  c.print(req);

  unsigned long t0 = millis();
  while (c.connected() && millis() - t0 < 3000) {
    while (c.available()) c.read();
    esp_task_wdt_reset();
    delay(10);
  }
  c.stop();
}

// --------------------------------------------------------------------------
// Actuate
// --------------------------------------------------------------------------
static void actuate(const String &name) {
  floodRecord();
  relayWrite(true);
  delay(PULSE_MS);
  relayWrite(false);
  delay(500);  // let the door start moving before we read the sensor
  Serial.printf("[actuate] %s -> door now %s\n", name.c_str(), doorState());
  postLog(name);
}

// --------------------------------------------------------------------------
// Verify one payload; actuate on success. Returns true iff actuated.
// --------------------------------------------------------------------------
static bool reject(const char *src, const String &name, const char *why) {
  Serial.printf("[reject] src=%s user=%s reason=%s\n", src,
                name.length() ? name.c_str() : "?", why);
  return false;
}

static bool verifyAndActuate(const String &rawIn, const char *src) {
  String p = rawIn;
  p.trim();

  int a = p.indexOf(';');
  int b = p.indexOf(';', a + 1);
  int c = p.indexOf(';', b + 1);
  if (a < 0 || b < 0 || c < 0 || p.indexOf(';', c + 1) >= 0)
    return reject(src, "", "format");

  String ver = p.substring(0, a);
  String tsStr = p.substring(a + 1, b);
  String name = p.substring(b + 1, c);
  String sig = p.substring(c + 1);

  if (ver != "v1") return reject(src, name, "version");
  if (name.length() < 1 || name.length() > 31)
    return reject(src, name, "name-len");
  for (size_t i = 0; i < name.length(); i++) {
    char ch = name[i];
    if (ch < 0x20 || ch == 0x7f || ch == ':' || ch == ';')
      return reject(src, name, "name-char");
  }
  if (sig.length() != 64) return reject(src, name, "sig-len");

  long ts = tsStr.toInt();
  if (ts <= 0) return reject(src, name, "ts-parse");

  int uidx = rosterIndex(name);
  if (uidx < 0) return reject(src, name, "unknown-user");

  time_t now = time(nullptr);
  if (now < 1700000000L) return reject(src, name, "no-ntp");
  long skew = (long)now - ts;
  if (skew < 0) skew = -skew;
  if (skew > FRESHNESS_WINDOW_S) return reject(src, name, "stale");
  if ((uint32_t)ts <= lastTs[uidx]) return reject(src, name, "replay");

  const char *kHex = ROSTER[uidx].k_hex;
  if (strlen(kHex) != 64) return reject(src, name, "bad-roster-key");

  // HMAC key = the 64 ASCII bytes of the hex string k (see docs/protocol.md)
  String msg = String("v1:") + tsStr + ":" + name;
  uint8_t mac[32];
  hmacSha256((const uint8_t *)kHex, 64, (const uint8_t *)msg.c_str(),
             msg.length(), mac);
  char macHex[65];
  bytesToHex(mac, 32, macHex);
  if (!constTimeHexEqual(macHex, sig.c_str())) return reject(src, name, "bad-sig");

  if (!floodOk()) return reject(src, name, "flood");

  lastTs[uidx] = (uint32_t)ts;
  Serial.printf("[open] user=%s src=%s\n", name.c_str(), src);
  actuate(name);
  return true;
}

// --------------------------------------------------------------------------
// ntfy command stream: a persistent GET on /<CMD_TOPIC>/raw, de-chunked into
// lines. Empty line = keepalive. Non-empty line = a payload.
// --------------------------------------------------------------------------
static WiFiClientSecure streamClient;
static bool streamUp = false;
static unsigned long streamBackoffMs = 1000;
static unsigned long lastStreamAttempt = 0;
static unsigned long lastStreamData = 0;

static bool rxChunked = false;
enum RxState { RX_SIZE, RX_DATA, RX_BODY };
static RxState rxState = RX_BODY;
static long rxChunkRem = 0;
static String rxSizeBuf;
static String rxLineBuf;

static void streamClose() {
  streamClient.stop();
  streamUp = false;
}

static bool streamConnect() {
  streamClient.stop();
  streamClient.setCACert(NTFY_ROOT_CA_BUNDLE);
  streamClient.setTimeout(10);
  esp_task_wdt_reset();  // blocking TLS handshake
  if (!streamClient.connect(NTFY_HOST, NTFY_PORT)) return false;
  esp_task_wdt_reset();

  streamClient.printf("GET /%s/raw HTTP/1.1\r\n"
                      "Host: %s\r\n"
                      "User-Agent: garage-esp32\r\n"
                      "Accept: text/plain\r\n"
                      "Connection: keep-alive\r\n\r\n",
                      CMD_TOPIC, NTFY_HOST);

  // Read status + headers, bounded and watchdog-fed.
  bool ok200 = false, headersDone = false;
  rxChunked = false;
  String cur;
  unsigned long t0 = millis();
  while (millis() - t0 < 8000) {
    esp_task_wdt_reset();
    if (!streamClient.connected() && streamClient.available() == 0) break;
    int ch = streamClient.read();
    if (ch < 0) {
      delay(5);
      continue;
    }
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (cur.length() == 0) {
        headersDone = true;
        break;
      }
      if (cur.startsWith("HTTP/")) ok200 = cur.indexOf(" 200") > 0;
      String low = cur;
      low.toLowerCase();
      if (low.startsWith("transfer-encoding:") && low.indexOf("chunked") >= 0)
        rxChunked = true;
      cur = "";
    } else if (cur.length() < 200) {
      cur += (char)ch;
    }
  }
  if (!headersDone || !ok200) {
    streamClient.stop();
    return false;
  }

  rxState = rxChunked ? RX_SIZE : RX_BODY;
  rxChunkRem = 0;
  rxSizeBuf = "";
  rxLineBuf = "";
  return true;
}

static void feedLineChar(int ch) {
  if (ch == '\r') return;
  if (ch == '\n') {
    if (rxLineBuf.length() > 0) {
      verifyAndActuate(rxLineBuf, "ntfy");
      rxLineBuf = "";
    }
    return;  // empty line => keepalive
  }
  if (rxLineBuf.length() < 256) rxLineBuf += (char)ch;
}

static void streamPump() {
  if (!streamUp) {
    if (millis() - lastStreamAttempt < streamBackoffMs) return;
    lastStreamAttempt = millis();
    if (streamConnect()) {
      streamUp = true;
      streamBackoffMs = 1000;
      lastStreamData = millis();
      Serial.println("[ntfy] connected");
    } else {
      streamBackoffMs = min(streamBackoffMs * 2, 60000UL);
      Serial.printf("[ntfy] connect failed; retry in %lu ms\n", streamBackoffMs);
    }
    return;
  }

  if (millis() - lastStreamData > 90000) {
    Serial.println("[ntfy] idle 90s, reconnecting");
    streamClose();
    return;
  }
  if (!streamClient.connected() && streamClient.available() == 0) {
    Serial.println("[ntfy] disconnected");
    streamClose();
    return;
  }

  int guard = 0;
  while (streamClient.available() > 0 && guard++ < 4096) {
    int ch = streamClient.read();
    if (ch < 0) break;
    lastStreamData = millis();

    switch (rxState) {
      case RX_BODY:
        feedLineChar(ch);
        break;
      case RX_SIZE:
        if (ch == '\n') {
          rxSizeBuf.trim();
          if (rxSizeBuf.length() > 0) {
            rxChunkRem = strtol(rxSizeBuf.c_str(), nullptr, 16);
            rxSizeBuf = "";
            if (rxChunkRem <= 0) {  // last chunk -> server closed the response
              streamClose();
              return;
            }
            rxState = RX_DATA;
          }
          // empty => the CRLF that trails the previous chunk; stay in RX_SIZE
        } else if (ch != '\r' && rxSizeBuf.length() < 16) {
          rxSizeBuf += (char)ch;
        }
        break;
      case RX_DATA:
        feedLineChar(ch);
        if (--rxChunkRem <= 0) rxState = RX_SIZE;
        break;
    }
  }
}

// --------------------------------------------------------------------------
// LAN HTTP
// --------------------------------------------------------------------------
static WebServer server(80);

static void handleRoot() {
  String h =
      "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
      "<title>garage</title><h2>garage controller</h2><p>door: <b>" +
      String(doorState()) + "</b></p><p>ntfy: " +
      (streamUp ? "connected" : "reconnecting") + "</p><p>uptime: " +
      String(millis() / 1000) + " s</p>"
      "<p>No UI here. Use the web button, a Shortcut, or POST a signed "
      "<code>v1;ts;name;sig</code> to <code>/open</code>.</p>";
  server.send(200, "text/html; charset=utf-8", h);
}

static void handleOpen() {
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "POST only\n");
    return;
  }
  bool ok = verifyAndActuate(server.arg("plain"), "lan");
  server.send(ok ? 204 : 403, "text/plain", ok ? "" : "rejected\n");
}

static void handleState() {
  String j = String("{\"door\":\"") + doorState() + "\",\"uptime_s\":" +
             (millis() / 1000) + ",\"ntfy\":\"" +
             (streamUp ? "connected" : "reconnecting") + "\"}";
  server.send(200, "application/json", j);
}

// --------------------------------------------------------------------------
// Wi-Fi
// --------------------------------------------------------------------------
static unsigned long wifiDownSince = 0;

static void wifiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);

  if (strlen(STATIC_IP) > 0) {
    IPAddress ip, gw, sn, dns;
    ip.fromString(STATIC_IP);
    gw.fromString(GATEWAY_IP);
    sn.fromString(SUBNET_MASK);
    dns.fromString(DNS_IP);
    WiFi.config(ip, gw, sn, dns);
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[wifi] connecting");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(500);
    Serial.print('.');
    esp_task_wdt_reset();
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] up, ip=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[wifi] connect failed, restarting");
    delay(1000);
    ESP.restart();
  }
}

// --------------------------------------------------------------------------
// setup / loop
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[boot] garage controller");

  pinMode(RELAY_GPIO, OUTPUT);
  relayWrite(false);  // inactive as early as possible
#if SENSOR_GPIO >= 0
  pinMode(SENSOR_GPIO, INPUT_PULLUP);
#endif

  // Watchdog on the loop task. If esp_task_wdt_init() returns INVALID_STATE the
  // core already initialised the TWDT (default 5 s) - the blocking network
  // paths call esp_task_wdt_reset() around their handshakes to stay inside it.
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);

  wifiConnect();

  configTzTime(TZ_STRING, "pool.ntp.org", "time.nist.gov");
  Serial.print("[time] waiting for NTP");
  for (int i = 0; i < 40 && time(nullptr) < 1700000000L; i++) {
    delay(500);
    Serial.print('.');
    esp_task_wdt_reset();
  }
  Serial.printf("\n[time] epoch=%ld\n", (long)time(nullptr));

  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("http", "tcp", 80);
    Serial.printf("[mdns] http://%s.local/\n", MDNS_HOST);
  }

  ArduinoOTA.setHostname(MDNS_HOST);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([]() { relayWrite(false); });
  ArduinoOTA.begin();

  server.on("/", handleRoot);
  server.on("/open", handleOpen);
  server.on("/state", handleState);
  server.begin();

  Serial.printf("[setup] done; roster has %d user(s)\n", rosterCount());
}

void loop() {
  esp_task_wdt_reset();
  ArduinoOTA.handle();
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiDownSince == 0) wifiDownSince = millis();
    if (millis() - wifiDownSince > 120000) {
      Serial.println("[wifi] down > 2 min, restarting");
      ESP.restart();
    }
    streamClose();
    WiFi.reconnect();
    delay(500);
    return;
  }
  wifiDownSince = 0;

  streamPump();
}

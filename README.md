# CATODO

Private IPTV receiver for the Tesla browser. One HTML file, zero frameworks, zero backend.

Channel source: `Free-TV/IPTV`, a playlist of channels declared free to air only.
No stream is hosted here: the page points to the same public URLs you would use in VLC.

---

## 1. What I checked before writing the code

### The Tesla browser

It is Chromium, not Safari. The user agents collected show `Chromium/88` with a `Tesla/<firmware version>` suffix.
Two practical consequences:

- **No native HLS.** Chromium only added the HLS demuxer from version 142. On an 88 engine the tag `<video src="...m3u8">` does nothing. A library on Media Source Extensions is required.
- **Old engine.** No `container queries`, no `:has()`, caution with modern syntax. The code in here sits on ES2016 and CSS that has worked since 2020.

### The player

I looked at hls.js, Video.js, Shaka Player, Vidstack, Plyr and mpegts.js.

| | verdict |
|---|---|
| **hls.js** | **chosen.** It is the engine underneath almost all the others. No UI to fight, direct control over errors, ~90 KB gzip bundle. Only requirement: MSE with `video/MP4` mime, which the Tesla's Chromium 88 has. |
| Video.js | great for branded VOD, but drags in a heavy theme and still uses hls.js underneath. Useless weight on the car's SIM. |
| Shaka Player | excellent on DASH and DRM. No DRM is needed here and the bundle is bigger. |
| Vidstack, Plyr | nice UI but designed for mouse and desktop. The touch targets are too small for a car screen. |
| mpegts.js | only needed for raw `.ts` streams: in the playlist that is 7 channels out of 1930. Not worth the dependency. |

Error handling: the player retries twice over the network, twice to recover the decoder, then moves to the next channel. In a car, with coverage coming and going, this is what makes the difference between "it works" and "it does not work".

### Full screen

The Tesla browser occupies two thirds of the screen and the Fullscreen API does not expand it: it expands the video inside that window.
The method the community has used for years (Channels DVR documents it officially, and ABetterTheater and Fullscreen Hub are built on top of it) is to go through a YouTube redirect: the system opens the YouTube app's webview, which is full screen, and then redirects it to your site.

```
https://www.youtube.com/redirect?q=https://your-catodo.pages.dev
```

In the car: paste, tap "go to site", save as a bookmark. The field in Catodo's settings generates this link ready made for you.
Honest note: this is undocumented behavior, some firmware versions have blocked it and then restored it. If it stops working one day, the player still works, just in a window.

### The two real walls: CORS and mixed content

They are the reason most IPTV players in the browser "do not work", and nobody explains it.

1. **CORS.** hls.js downloads the manifest, every variant, every segment and every AES key via XHR. Each of those requests is cross-origin and the browser blocks it if the server does not send `Access-Control-Allow-Origin`. Fixing only the manifest is not enough: playback starts and dies at the first segment. A stream that plays in VLC may well not play in the browser: VLC knows nothing about CORS.
2. **Mixed content.** The playlist has 257 channels on `http://`. A page served over https cannot load them, Chromium just blocks them. In the subset you care about, that is 109.

Both are solved with the same piece: `worker.js`, a Cloudflare Worker that redoes the request server side, adds the CORS headers, rewrites the playlist so the segments also go back through it, and closes the http to https gap. Free up to 100,000 requests a day.

### What to expect from a public list

Running the Free-TV list through `check-playlist.mjs`: 1930 entries, 1918 unique.
1576 open directly in the browser as they are, 257 are on `http` and need the proxy,
85 will never open (72 YouTube, 6 RTMP, 4 Twitch, 3 Dailymotion).

This holds for any list: roughly one channel in seven is not usable in a browser,
and the number has nothing to do with the quality of the source. That is the reason `check-playlist.mjs`
exists.

Two things to keep in mind when choosing:

- **Geoblocking.** Many national channels look at the IP address. In the car the Tesla SIM can give you
  an Italian or Swiss address depending on the network it latches onto, and the same channel behaves
  differently from one day to the next.
- **Provenance.** Any public list can end up with streams that do not come from the
  broadcaster but from resale panels. They are recognizable: bare IP addresses with high ports,
  paths like `/user/password/12345`. They are not free to air, and should be removed.

---

## 2. Files

```
app.html              the player. Arrives with no list inside. Served only through index.php.
index.php              login gate: checks username and password against .htpasswd, then streams app.html
worker.js              Cloudflare proxy for CORS, mixed content and hotlinking. Does not go on the FTP.
check-playlist.mjs     diagnostics: tells you which channels of your list will open in the browser
gen-htpasswd.mjs       generates .htpasswd (bcrypt) from HTPASSWD_USER/HTPASSWD_PASSWORD in .env
test-pin.mjs           automated test for the PIN gate
.htaccess              blocks direct access to app.html and forces the login through index.php
README.md              this file
BRIEF.md               open tasks, for whoever works on this
```

---

## 3. Getting it on the road

### Step 1: the PIN

In `app.html`, around line 490:

```js
const CFG = {
  pin: "1984",     // change it
```

### Step 2: private repo + Cloudflare Pages

GitHub Pages from a private repo requires a paid plan. Cloudflare Pages does not, and it is also closer as a network.

```
private repo on GitHub, push the files
dash.cloudflare.com > Workers & Pages > Create > Pages > Connect to Git
build command: (empty)     output directory: /
```

You get a `https://catodo-xxx.pages.dev`. If you prefer, you can point your own subdomain at it.

### Step 3: real protection

The PIN in the page is convenience, not security: anyone who opens the source reads it in five seconds. It keeps out those who stumble onto it by chance, not a real attack. Since the deploy is on classic FTP hosting, the real barrier is HTTP Basic Auth via `.htaccess`:

```
HTPASSWD_USER and HTPASSWD_PASSWORD in .env, then:
node gen-htpasswd.mjs
```

Upload `.htaccess`, `.htpasswd` and `robots.txt` to the FTP along with the site. From that point on the browser asks for a username and password before it even shows the page, PIN included.

**Future upgrade path.** If the domain one day moves to Cloudflare, the better protection becomes Cloudflare Access with a policy on email addresses:

```
Cloudflare > Zero Trust > Access > Applications > Add > Self-hosted
domain: catodo.netmilk.dev
policy: Allow > Emails > your email
```

Free up to 50 users, no password in the repo, session as long as you like. Not necessary now: Basic Auth already protects the site.

### Step 4: the proxy

```
Workers & Pages > Create > Worker
paste worker.js > Deploy
```

Then in `worker.js` set `ALLOW_ORIGIN` to your real domain instead of `*`, otherwise anyone who finds out the URL gets a free proxy.
Copy the worker's address into Catodo's settings. From that point on channels marked `HTTP` become openable and the ones that gave a CORS error start.

### Step 5: the lists

There is nothing to prepare. On first launch CATODO opens the sources screen and asks you
to load one. Inside you will find a curated list of independent public projects to
start from, with a button that fills the field for you. The lists are downloaded by the browser
directly from their server and cached locally for twelve hours.

To understand what is worth keeping in a list, before loading it:

```
node check-playlist.mjs https://.../list.m3u
node check-playlist.mjs https://.../list.m3u --deep --csv
```

It tells you how many channels will open in the browser as they are, how many need the proxy and how many
are unrecoverable. With `--deep` it actually downloads the manifests and checks the CORS headers.

### Step 6: in the car

1. Parked. The video only starts while stationary.
2. Browser, paste the YouTube redirect link generated in the settings.
3. "Go to site", then bookmark it.
4. PIN, category, channel.

---

## 4. Identity

The name comes from the cathode ray tube. Everything else follows from that.

**The EBU color bars.** Seven standardized values (white, yellow, cyan, green, magenta, red, blue) used as a system, not as decoration: each channel category takes a bar and keeps it everywhere, in the column, in the card's border, in the on screen number, in the thread above the tuning bar. Italy green, Switzerland red, movies magenta, news cyan. The color tells you where you are before you read it.

**The background is not black.** It is `#0C0D0B`, the warm green-black of the glass of a switched off tube. And the white is not white, it is `#F0EBE1`. A television turned on at night has never had a pure black.

**The test card.** On opening, the seven bars drop one after another, the logotype appears on the black band, then everything collapses. It lasts a bit over a second and can be skipped by tapping the screen.

**The power off.** When you close a channel the image squashes into a horizontal line, whitens and disappears into a point. It is the physical behavior of the object the software takes its name from, and it costs four CSS keyframes.

**The convergence error.** The logotype has a thread of red on the right and cyan on the left, like a poorly aligned tube. Only the logotype, never the current text.

**The cathode effect** is off by default and turns on from the button while watching or from the settings: scan lines, RGB phosphor mask and vignetting. Nice, but it really does reduce sharpness, so the choice is always yours.

**The clock in the header** is in Televideo format (`TUE 11 AUG 17:42`), which in the car is more useful than it sounds.

## 5. How the interface is built

It is not a Netflix style grid, it is a tuner. The difference matters because in the car you are not browsing a catalog: you are channel surfing.

- **Tuning bar at the bottom.** Channel number on a solid block of the category color, name, real resolution negotiated by hls.js and a signal indicator that reads the real bandwidth estimate, red when you are below it. On a shaky LTE connection you see the problem before you suffer it.
- **On screen number.** When you zap, the number appears in the top left on a colored background along with the channel name, for two and a half seconds. It is the OSD of nineties televisions and does exactly the job it did back then.
- **`◀ CH` and `CH ▶` paddles at 112 px.** Cyclic zapping within the current category, automatically skips unplayable channels and starts over from the beginning at the end of the list. They can be tapped without looking.
- **72 px minimum target** everywhere, because a 15 inch screen half a meter away with your finger is not a mouse.
- **Overlays that disappear** after 4 seconds, a tap brings them back.
- **Fit / fill**, because the Highland's 15.4" is wider than 16:9 and some SD channels are in 4:3.
- **Quality limited to window size** on by default: it does not download 1080p to fill half a screen. On the car's SIM it is the biggest source of data usage.
- **Unplayable channels** marked `HTTP`, `YT`, `RTMP` instead of hidden silently, so you know why they are missing.

Favorites and history live in `localStorage` with an in memory fallback: if the browser blocks storage the page does not break, it only loses memory between one session and the next.

---

## 6. If something does not start

| symptom | cause | what to do |
|---|---|---|
| `STREAM BLOCKED (CORS OR OFFLINE)` | the server does not send the CORS headers | turn on the proxy |
| the channel has the `HTTP` badge | mixed content | turn on the proxy |
| 403 error on just one channel | hotlink protection | add the host to `RULES` inside `worker.js` with the right Referer and Origin |
| `CODEC NOT SUPPORTED` | the stream is HEVC or AC-3 | not fixable on the browser side, it is a decoder gap |
| channel with the `GEO` badge that does not start | geoblocking on the SIM's IP | depends on where the Tesla network finds you |
| everything black but the audio works | rare on older Chromium builds | tap "fill screen", it forces a redraw |
| the list does not load | GitHub raw unreachable | a local `channels.json` covers this case |

---

## 7. The legal position

I am not a lawyer and this is not legal advice. But the architecture was chosen to
keep the project on the simple side of the question, and it is worth understanding why.

**CATODO is a player, not a catalog.** It does not contain lists, does not host streams, does not act as an
intermediary between whoever watches and whoever broadcasts. It is the same category as VLC, Kodi or IPTVnator:
neutral software, which only becomes useful once the user gives it its own content.

**We do not redistribute anything.** The first version of this project included a filtered copy
of the Free-TV playlist inside the repo. Even though the upstream file is public, that
copy was still a redistribution: a choice the upstream project makes for itself and
takes responsibility for, one you have no reason to inherit. Now that file no longer exists. The
list is downloaded by the browser of whoever uses the app, directly from the server of whoever publishes it.

**On the links.** The sources screen points to independent projects and shows both the
project's page and the list's address. One honest point of attention: the European Court of
Justice, in the 2016 GS Media case, ruled that linking to unauthorized content
can be relevant when whoever links does so for profit or knowing the
content is unlawful. Three reasons why the position here is comfortable: the site is private and
without profit motive, the listed projects both state they only collect streams made
public by the rights holders, and the text at the bottom of the screen clearly states that
CATODO does not verify or guarantee what is on the other side.

**What remains your responsibility.** Load only lists you have the right to watch. In practice:
channels broadcast free of charge by their stations. If a public list contains streams that
come from resale panels instead of the broadcaster, it is not free to air: remove it or
do not use that source. `check-playlist.mjs` helps you spot them.

**On the context.** You live in Italy and work in Switzerland, so Italian rules apply
for use and the hosting country's rules apply for the site. In Italy AGCOM has very sharp powers
over services that distribute content, but those concern whoever distributes: a private page,
password protected, for personal use, with no content of its own, is a different planet. The fact
that it sits behind authentication and with `noindex` is not just hygiene, it is part of the position.

**On logos.** When the playlist does not provide a channel logo, some known broadcasters show one fetched live from [logo.dev](https://logo.dev): CATODO never saves or hosts those files, the viewer's browser requests them, every time. Channel names and logos remain trademarks of their respective broadcasters; CATODO is not affiliated with them.

Finally: the Tesla browser only plays video while the vehicle is parked, which is exactly the way
this thing is meant to be used.

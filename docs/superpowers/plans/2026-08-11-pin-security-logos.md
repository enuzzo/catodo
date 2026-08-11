# PIN, sicurezza vera e loghi canale: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere l'Incarico 3 (bug del PIN, con test automatico), l'Incarico 4 (barriera vera via HTTP Basic Auth su `.htaccess`) e la feature loghi canale via logo.dev, come da spec approvato.

**Architecture:** Nessun nuovo servizio, nessun passaggio di build. Tre gruppi di modifiche indipendenti su `index.html`, sul deploy FTP e sul repo, ciascuno con il proprio commit. Il PIN resta lato client (comodita, non sicurezza); la barriera vera e Apache Basic Auth davanti a tutto il sito; i loghi mancanti nella playlist vengono recuperati al volo da logo.dev via una tabella statica nome canale -> dominio, mai salvati da CATODO.

**Tech Stack:** HTML/CSS/JS inline (ES2016, `"use strict"`), Node ESM per gli script locali (`jsdom` per i test, `bcryptjs` per l'hash), Apache `.htaccess`/`mod_rewrite`/`mod_headers`, Cloudflare Worker (`worker.js`, deploy manuale da dashboard).

## Global Constraints

- Niente framework, niente dipendenza runtime lato browser oltre `hls.js` da CDN (gia presente). Ogni nuova dipendenza (`jsdom`, `bcryptjs`) e solo per script locali, mai spedita al browser.
- JS lato client resta ES2016, dentro `"use strict"` gia presente in cima allo `<script>` inline di `index.html` (riga 481). Niente `:has()`, niente container queries.
- CATODO non ridistribuisce contenuti: nessun file di canali nel repo, nessuna immagine di logo ospitata o salvata da noi. La tabella `CFG.logoDomains` e solo testo (nome -> dominio); l'immagine la serve sempre `logo.dev` dal browser di chi guarda.
- Mai trattini lunghi o medi in nessun testo scritto (README, commenti, messaggi di commit): usa virgole, parentesi, due punti o trattini corti.
- `.env`, `.env.*` (tranne `.env.example`) e `.htpasswd` non vanno mai in git.
- Un commit separato e leggibile per ogni incarico: PIN, sicurezza, loghi.
- Il PIN va verificato con un test automatico, non a occhio.
- Prima di dichiarare finito il lavoro: verifica in un browser vero (apertura, PIN, caricamento di una lista M3U reale, apertura canale, zapping avanti e indietro, chiusura).

---

## Task 1: Harness di test per il PIN (stato rosso)

**Files:**
- Create: `package.json`
- Create: `test-pin.mjs`

**Interfaces:**
- Produces: script eseguibile `node test-pin.mjs`, esce con codice `0` se tutti i casi passano, `1` altrimenti. Nessuna funzione esportata: e uno script standalone come `check-playlist.mjs`.

- [ ] **Step 1: Inizializza package.json**

```bash
cd /Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo
npm init -y
```

- [ ] **Step 2: Modifica package.json**

Apri `package.json` appena creato e sostituiscine il contenuto con:

```json
{
  "name": "catodo",
  "private": true,
  "type": "module",
  "scripts": {
    "test:pin": "node test-pin.mjs"
  }
}
```

- [ ] **Step 3: Installa jsdom come dipendenza di sviluppo**

```bash
npm install --save-dev jsdom
```

Expected: crea `node_modules/` e `package-lock.json`, aggiunge `"devDependencies": { "jsdom": "^..." }` a `package.json`. `node_modules/` e gia coperto da `.gitignore`.

- [ ] **Step 4: Scrivi test-pin.mjs**

Crea `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/test-pin.mjs`:

```js
/**
 * CATODO: test del gate PIN
 *
 * Carica index.html in jsdom e verifica i casi che hanno causato il bug
 * originale (numero ottale non quotato, spazio finale da copia e incolla),
 * piu il comportamento base del gate. Stampa PASS/FAIL per ogni caso ed
 * esce con codice diverso da zero se qualcosa fallisce.
 *
 *   node test-pin.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("./index.html", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadHtml(){
  const raw = await readFile(HTML_PATH, "utf8");
  return raw.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/hls\.js[^"]*"><\/script>\s*/, "");
}

function overridePin(html, literal){
  return html.replace(/pin:\s*"[^"]*"/, "pin: " + literal);
}

async function openGate(html){
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://catodo.test/"
  });
  await sleep(0);
  return dom;
}

async function skipIntro(dom){
  dom.window.document.getElementById("testcard").click();
  await sleep(500);
}

function pressDigits(dom, digits){
  const buttons = [...dom.window.document.querySelectorAll("#pad button")];
  for (const ch of digits){
    const btn = buttons.find(b => b.textContent === ch);
    if (!btn) throw new Error("pulsante non trovato per la cifra " + ch);
    btn.click();
  }
}

const results = [];
function check(name, cond){
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
}

// Caso 1: PIN corretto (1984) sblocca il gate
{
  const dom = await openGate(await loadHtml());
  check("CFG.pin e impostato a 1984", dom.window.eval("CFG.pin") === "1984");
  check("i pallini generati sono 4 come il PIN", dom.window.document.querySelectorAll("#dots i").length === 4);
  await skipIntro(dom);
  pressDigits(dom, "1984");
  await sleep(250);
  check("PIN corretto (1984) sblocca il gate", dom.window.document.getElementById("gate").classList.contains("hide"));
}

// Caso 2: PIN sbagliato viene rifiutato
{
  const dom = await openGate(await loadHtml());
  await skipIntro(dom);
  pressDigits(dom, "0000");
  await sleep(250);
  const doc = dom.window.document;
  check("PIN sbagliato non sblocca il gate", !doc.getElementById("gate").classList.contains("hide"));
  check("i pallini segnalano l errore", doc.getElementById("dots").classList.contains("bad"));
}

// Caso 3: spazio finale nel PIN configurato non deve impedire l accesso
{
  const html = overridePin(await loadHtml(), '"1984 "');
  const dom = await openGate(html);
  check("CFG.pin con spazio finale resta 1984 dopo il trim", dom.window.eval("CFG.pin.trim()") === "1984");
  await skipIntro(dom);
  pressDigits(dom, "1984");
  await sleep(250);
  check("PIN digitato senza spazio sblocca comunque il gate", dom.window.document.getElementById("gate").classList.contains("hide"));
}

// Caso 4: il numero di pallini segue la lunghezza reale del PIN
{
  const html = overridePin(await loadHtml(), '"12"');
  const dom = await openGate(html);
  check("i pallini seguono un PIN di 2 cifre", dom.window.document.querySelectorAll("#dots i").length === 2);
}

// Caso 5: pin ottale non quotato rompe il parsing in strict mode
{
  const html = await loadHtml();
  const m = html.match(/<script>\n"use strict";[\s\S]*?<\/script>/);
  if (!m) throw new Error("script inline non trovato");

  const brokenSrc = overridePin(m[0], "0712").replace(/^<script>\n/, "").replace(/<\/script>$/, "");
  let threw = false;
  try { new Function(brokenSrc); } catch (e) { threw = e instanceof SyntaxError; }
  check("pin: 0712 senza virgolette rompe il parsing (SyntaxError)", threw);

  const fixedSrc = overridePin(m[0], '"1984"').replace(/^<script>\n/, "").replace(/<\/script>$/, "");
  let ok = true;
  try { new Function(fixedSrc); } catch { ok = false; }
  check('pin: "1984" tra virgolette non rompe il parsing', ok);
}

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " casi passati");
if (failed.length) process.exit(1);
```

- [ ] **Step 5: Esegui il test e osserva il rosso atteso**

```bash
npm run test:pin
```

Expected: `CFG.pin e impostato a 1984` e `PIN corretto (1984) sblocca il gate` falliscono con `FAIL` (perche `CFG.pin` in `index.html` e ancora `"1957"`). Gli altri casi (PIN sbagliato rifiutato, spazio finale tollerato, pallini dinamici, ottale non quotato) devono gia risultare `PASS`, perche quella logica e gia corretta nel codice esistente. Il comando esce con codice `1`.

Non fare commit in questo task: package.json e test-pin.mjs vengono committati insieme al cambio di valore nel Task 2.

---

## Task 2: Aggiorna il PIN a 1984 (stato verde, commit Incarico 3)

**Files:**
- Modify: `index.html:489`

**Interfaces:**
- Consumes: `test-pin.mjs` dal Task 1.

- [ ] **Step 1: Cambia il valore del PIN**

In `index.html`, riga 489:

```js
  pin: "1957",
```

diventa:

```js
  pin: "1984",
```

- [ ] **Step 2: Rilancia il test e verifica il verde**

```bash
npm run test:pin
```

Expected: tutti e 8 i controlli mostrano `PASS`, riga finale `8/8 casi passati`, codice di uscita `0`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json test-pin.mjs index.html
git commit -m "$(cat <<'EOF'
fix: PIN a 1984 con test automatico del gate

Il confronto nel gate era gia tollerante a spazi e gia validava le
cifre, ma non esisteva un test che lo dimostrasse invece di fidarsi
a occhio. test-pin.mjs copre i due casi del bug originale (ottale
non quotato, spazio finale da copia e incolla) piu il comportamento
base.
EOF
)"
```

---

## Task 3: Artefatti per la Basic Auth (locale, nessun upload)

**Files:**
- Modify: `.env.example`
- Modify: `.env`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `worker.js:20`
- Modify: `README.md:111-121`
- Create: `gen-htpasswd.mjs`
- Create: `.htaccess`
- Create: `robots.txt`

**Interfaces:**
- Produces: `node gen-htpasswd.mjs [percorso-env]` legge `HTPASSWD_USER`/`HTPASSWD_PASSWORD` e scrive `.htpasswd` nella stessa cartella del file env passato.

- [ ] **Step 1: Aggiungi le variabili Basic Auth a .env.example**

In `.env.example`, aggiungi in fondo:

```
HTPASSWD_USER=
HTPASSWD_PASSWORD=
```

- [ ] **Step 2: Aggiungi le stesse chiavi vuote a .env**

In `.env` (gia ignorato da git), aggiungi in fondo le stesse due righe vuote:

```
HTPASSWD_USER=
HTPASSWD_PASSWORD=
```

Non inventare valori: restano vuote, le riempie il proprietario.

- [ ] **Step 3: Aggiungi .htpasswd al .gitignore**

In `.gitignore`, aggiungi una riga:

```
.htpasswd
```

- [ ] **Step 4: Installa bcryptjs**

```bash
npm install --save-dev bcryptjs
```

- [ ] **Step 5: Aggiungi lo script gen:htpasswd a package.json**

In `package.json`, dentro `"scripts"`, aggiungi:

```json
    "gen:htpasswd": "node gen-htpasswd.mjs"
```

(risultato atteso: `"scripts": { "test:pin": "node test-pin.mjs", "gen:htpasswd": "node gen-htpasswd.mjs" }`)

- [ ] **Step 6: Scrivi gen-htpasswd.mjs**

Crea `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/gen-htpasswd.mjs`:

```js
/**
 * CATODO: genera .htpasswd
 *
 * Legge HTPASSWD_USER e HTPASSWD_PASSWORD da un file .env (di default
 * quello nella cartella corrente) e scrive .htpasswd nella stessa cartella,
 * con hash bcrypt nel formato $2y$ che Apache riconosce. Il file risultante
 * non va mai in git ne in un futuro caricamento automatico: va portato
 * sull FTP a mano, ogni volta che la password cambia.
 *
 *   node gen-htpasswd.mjs [percorso-env]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

function parseEnv(text){
  const out = {};
  for (const line of text.split(/\r?\n/)){
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const envPath = path.resolve(process.argv[2] || ".env");
let raw;
try { raw = await readFile(envPath, "utf8"); }
catch { console.error("non trovo " + envPath); process.exit(1); }

const env = parseEnv(raw);
const missing = ["HTPASSWD_USER", "HTPASSWD_PASSWORD"].filter(k => !env[k]);
if (missing.length){
  console.error("mancano variabili in " + envPath + ": " + missing.join(", "));
  process.exit(1);
}

const hash = bcrypt.hashSync(env.HTPASSWD_PASSWORD, 10).replace(/^\$2[aby]\$/, "$2y$");
const outPath = path.join(path.dirname(envPath), ".htpasswd");
await writeFile(outPath, env.HTPASSWD_USER + ":" + hash + "\n", "utf8");
console.log("scritto " + outPath + " per l utente " + env.HTPASSWD_USER);
```

- [ ] **Step 7: Verifica gen-htpasswd.mjs con una coppia di prova, fuori dal repo**

```bash
SCRATCH=/private/tmp/claude-501/-Users-enuzzo-Library-CloudStorage-Dropbox-Mitnick-catodo/56153107-1b04-42e2-aa14-4f8c6f9ae44b/scratchpad/htpasswd-check
mkdir -p "$SCRATCH"
printf 'HTPASSWD_USER=testuser\nHTPASSWD_PASSWORD=testpass123\n' > "$SCRATCH/.env"
node gen-htpasswd.mjs "$SCRATCH/.env"
cat "$SCRATCH/.htpasswd"
```

Expected: stampa `scritto .../.htpasswd per l utente testuser`, e il contenuto del file matcha `^testuser:\$2y\$\d{2}\$[./A-Za-z0-9]{53}$`.

Poi verifica che l'hash sia davvero valido per quella password:

```bash
node -e '
import("bcryptjs").then(async ({ default: bcrypt }) => {
  const fs = await import("node:fs/promises");
  const line = (await fs.readFile(process.env.HFILE, "utf8")).trim();
  const hash = line.split(":")[1].replace(/^\$2y\$/, "$2b$");
  console.log(bcrypt.compareSync("testpass123", hash) ? "hash valido" : "HASH NON VALIDO");
});
' HFILE="$SCRATCH/.htpasswd"
```

Expected: `hash valido`. Poi ripulisci lo scratch:

```bash
rm -rf "$SCRATCH"
```

- [ ] **Step 8: Scrivi .htaccess**

Crea `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/.htaccess`:

```apache
# CATODO: barriera vera davanti al sito. Il PIN nella pagina non basta da
# solo (vedi README, sezione 3): questo file e la protezione reale,
# richiesta prima ancora di servire index.html.

AuthType Basic
AuthName "Accesso riservato"
AuthUserFile .htpasswd
Require valid-user

<Files ".htpasswd">
  Require all denied
</Files>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
</IfModule>
```

- [ ] **Step 9: Scrivi robots.txt**

Crea `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/robots.txt`:

```
User-agent: *
Disallow: /
```

- [ ] **Step 10: Blocca ALLOW_ORIGIN nel worker al dominio reale**

In `worker.js`, riga 20:

```js
const ALLOW_ORIGIN = "*";
```

diventa:

```js
const ALLOW_ORIGIN = "https://catodo.netmilk.dev";
```

- [ ] **Step 11: Aggiorna README.md, sezione "Passo 3"**

In `README.md`, sostituisci il blocco (righe 111-121):

```markdown
### Passo 3: protezione seria

Il PIN nella pagina e comodita, non sicurezza: chi apre il sorgente lo legge. Va benissimo per tenere fuori chi ci capita sopra, ma la barriera vera si mette prima:

```
Cloudflare > Zero Trust > Access > Applications > Add > Self-hosted
dominio: catodo-xxx.pages.dev
policy: Allow > Emails > la tua mail
```

Gratis fino a 50 utenti. Chiede un codice via mail al primo accesso e poi tiene la sessione per il periodo che imposti: metti 30 giorni e in auto non lo rivedi quasi mai. Alternativa piu spiccia: policy su intervallo IP, o direttamente `Cloudflare Access Service Token`.
```

con:

```markdown
### Passo 3: protezione vera

Il PIN nella pagina e comodita, non sicurezza: chi apre il sorgente lo legge in cinque secondi. Tiene fuori chi ci capita sopra per caso, non un attacco vero. Dato che il deploy e su hosting FTP classico, la barriera vera e HTTP Basic Auth via `.htaccess`:

```
HTPASSWD_USER e HTPASSWD_PASSWORD in .env, poi:
node gen-htpasswd.mjs
```

Carica `.htaccess`, `.htpasswd` e `robots.txt` sull FTP insieme al sito. Da quel momento il browser chiede utente e password prima ancora di mostrare la pagina, PIN compreso.

**Percorso di aggiornamento futuro.** Se il dominio passa un giorno su Cloudflare, la protezione migliore diventa Cloudflare Access con policy sulla mail:

```
Cloudflare > Zero Trust > Access > Applications > Add > Self-hosted
dominio: catodo.netmilk.dev
policy: Allow > Emails > la tua mail
```

Gratis fino a 50 utenti, nessuna password nel repo, sessione lunga a piacere. Non necessario adesso: la Basic Auth gia protegge il sito.
```

- [ ] **Step 12: Commit**

```bash
git add .env.example .gitignore package.json package-lock.json gen-htpasswd.mjs .htaccess robots.txt worker.js README.md
git commit -m "$(cat <<'EOF'
feat: Basic Auth via .htaccess davanti al sito

Il PIN nell HTML resta comodita, non protezione: la barriera vera e
Apache Basic Auth. gen-htpasswd.mjs genera .htpasswd (bcrypt, formato
$2y$) dalle variabili in .env, mai versionato. worker.js non accetta
piu richieste da qualunque origine, solo dal dominio reale del sito.
EOF
)"
```

Non e ancora stato caricato niente sull FTP: lo fa il Task 4.

---

## Task 4: Verifica dal vivo della Basic Auth (upload FTP + curl)

**Files:** nessuno nel repo (solo upload sull hosting FTP e verifica in rete).

**Interfaces:**
- Consumes: `.htaccess`, `robots.txt` dal Task 3; `HTPASSWD_USER`/`HTPASSWD_PASSWORD` da `.env`, riempiti dal proprietario prima di questo task.

- [ ] **Step 1: Chiedi al proprietario di riempire le credenziali Basic Auth**

Prima di procedere, chiedi all'utente di aprire `.env` e riempire `HTPASSWD_USER` e `HTPASSWD_PASSWORD` (login del sito, diverso dalle credenziali FTP). Non proporre ne generare tu questi valori.

- [ ] **Step 2: Genera .htpasswd reale**

```bash
node gen-htpasswd.mjs
```

Expected: crea `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/.htpasswd`.

- [ ] **Step 3: Carica .htaccess, .htpasswd e robots.txt sull FTP**

Scrivi ed esegui uno script Node temporaneo nello scratchpad che legge le credenziali FTP da `.env` (stesso pattern gia usato in sessione per il test FTP iniziale: mai stampare le credenziali, solo esito) e carica i tre file nella root FTP con `basic-ftp`:

```js
import { readFile } from "node:fs/promises";
import { Client } from "basic-ftp";

const envPath = process.argv[2];
const raw = await readFile(envPath, "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const client = new Client(15000);
try {
  await client.access({
    host: env.FTP_HOST, port: Number(env.FTP_PORT) || 21,
    user: env.FTP_USER, password: env.FTP_PASSWORD,
    secure: env.FTP_SECURE !== "false",
  });
  await client.uploadFrom("/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/.htaccess", ".htaccess");
  await client.uploadFrom("/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/.htpasswd", ".htpasswd");
  await client.uploadFrom("/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/robots.txt", "robots.txt");
  console.log("caricati: .htaccess, .htpasswd, robots.txt");
} finally {
  client.close();
}
```

- [ ] **Step 4: Verifica 401 senza credenziali e 200 con credenziali corrette**

Scrivi ed esegui un altro script Node temporaneo nello scratchpad che legge `SITE_URL`, `HTPASSWD_USER`, `HTPASSWD_PASSWORD` da `.env` e stampa solo i codici di stato, mai le credenziali:

```js
import { readFile } from "node:fs/promises";

const envPath = process.argv[2];
const raw = await readFile(envPath, "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const url = env.SITE_URL || "https://catodo.netmilk.dev";
const noAuth = await fetch(url, { redirect: "manual" });
console.log("senza credenziali:", noAuth.status);

const auth = "Basic " + Buffer.from(env.HTPASSWD_USER + ":" + env.HTPASSWD_PASSWORD).toString("base64");
const withAuth = await fetch(url, { headers: { Authorization: auth }, redirect: "manual" });
console.log("con credenziali:", withAuth.status);
```

Expected: `senza credenziali: 401`, `con credenziali: 200` (o `301`/`302` se il redirect a https scatta prima, in quel caso segui il redirect e ripeti la verifica sull URL https).

- [ ] **Step 5: Se la risposta non e 401/200, verifica AllowOverride con una sonda PHP**

Se il passo 4 restituisce `200` anche senza credenziali (la Basic Auth non e attiva) o un errore `500`, carica temporaneamente un file `probe.php` con questo contenuto:

```php
<?php echo $_SERVER['DOCUMENT_ROOT']; ?>
```

sull FTP, poi:

```bash
curl -s "https://catodo.netmilk.dev/probe.php"
```

Se risponde con un percorso assoluto, usa quel percorso per `AuthUserFile` in `.htaccess` (es. `AuthUserFile /home/xxx/www/catodo.netmilk.dev/public_html/.htpasswd`), ricarica `.htaccess` sull FTP e ripeti il passo 4. Se invece non risponde affatto (PHP non disponibile) o il codice resta `200` qualunque cosa tu faccia, l hosting non applica `AllowOverride` su questa cartella: fermati, non lasciare `.htaccess` a dare una falsa sensazione di sicurezza, e segnalalo chiaramente all utente. In ogni caso, rimuovi `probe.php` dall FTP appena finita la verifica.

- [ ] **Step 6: Ricorda il passo manuale su Cloudflare**

Comunica all'utente che `worker.js` e stato aggiornato nel repo (`ALLOW_ORIGIN` sul dominio reale) ma che il redeploy sul Worker Cloudflare resta manuale: dashboard, incolla il nuovo `worker.js`, Deploy, come gia documentato nel README.

Nessun commit in questo task: nessun file del repo cambia.

---

## Task 5: Loghi canale via logo.dev in index.html

**Files:**
- Modify: `index.html:488-538` (CFG)
- Modify: `index.html:1106-1123` (helper functions + makeTile)

**Interfaces:**
- Produces: `normalizeChannelName(name: string): string`, `logoDevUrl(c: {name: string}): string` (stringa vuota se non c e match o token assente). Usate da `makeTile(c, i)`.

- [ ] **Step 1: Estendi CFG con logoDevToken e logoDomains**

In `index.html`, sostituisci l'intero blocco (righe 488-538):

```js
const CFG = {
  pin: "1984",
  cacheHours: 12,

  /* Indirizzi di progetti indipendenti, non gestiti da CATODO.
     Sono collegamenti, non contenuti: la lista la scarica il browser di chi usa l app. */
  directory: [
    {
      name: "Free-TV / IPTV",
      what: "Curata a mano, solo emittenti dichiarate gratuite: niente canali a pagamento, niente adulti. Poche voci ma quasi tutte in HD. Buon punto di partenza per Italia e Svizzera.",
      project: "https://github.com/Free-TV/IPTV",
      url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
    },
    {
      name: "iptv-org, solo Italia",
      what: "Indice pubblico molto piu grande, diviso per paese. Il progetto dichiara di raccogliere solo collegamenti a flussi resi pubblici dai titolari dei diritti.",
      project: "https://github.com/iptv-org/iptv",
      url: "https://iptv-org.github.io/iptv/countries/it.m3u"
    },
    {
      name: "iptv-org, solo Svizzera",
      what: "Stesso progetto, elenco svizzero. Utile di qua dal confine, dove la SIM dell auto puo darti un indirizzo elvetico.",
      project: "https://github.com/iptv-org/iptv",
      url: "https://iptv-org.github.io/iptv/countries/ch.m3u"
    },
    {
      name: "iptv-org, indice completo",
      what: "Tutto il mondo in un file solo. Diverse migliaia di voci: pesante da caricare in auto, meglio partire da un elenco per paese.",
      project: "https://github.com/iptv-org/iptv",
      url: "https://iptv-org.github.io/iptv/index.m3u"
    },
    {
      name: "awesome-iptv",
      what: "Non e una lista di canali ma un elenco ragionato di risorse, strumenti e altri progetti. Da qui si arriva a tutto il resto.",
      project: "https://github.com/iptv-org/awesome-iptv",
      url: ""
    }
  ],

  /* ordine preferito dei gruppi, se presenti. Tutto il resto viene dopo, per numerosita. */
  order: ["Italy","Italia","Switzerland","Svizzera","VOD Italy","News","Documentaries (EN)",
          "Business","Weather","France","Germany","Austria","UK","Spain","Portugal",
          "Ireland","Netherlands","Belgium","USA"],
  label: {
    "Italy":"Italia","Switzerland":"Svizzera","VOD Italy":"Film e serie IT","News":"News",
    "Documentaries (EN)":"Documentari","Business":"Economia","Weather":"Meteo","France":"Francia",
    "Germany":"Germania","Austria":"Austria","UK":"Regno Unito","Spain":"Spagna",
    "Portugal":"Portogallo","Ireland":"Irlanda","Netherlands":"Paesi Bassi","Belgium":"Belgio",
    "USA":"Stati Uniti","Undefined":"Senza gruppo"
  },

  /* Token pubblicabile di logo.dev, va bene in chiaro lato client: e cosi che
     logo.dev lo progetta (come una chiave "publishable", non un segreto).
     Registrati gratis su https://logo.dev e incolla qui il tuo token. */
  logoDevToken: "",

  /* Solo testo: nome canale normalizzato (minuscolo, senza spazi o simboli,
     senza HD/4K/+1) -> dominio ufficiale dell emittente. Il logo lo serve
     sempre logo.dev dal dominio, mai un file nostro: CATODO non ospita ne
     salva immagini di loghi. Elenco volutamente parziale, punto di partenza
     per le emittenti italiane e svizzere principali, estendibile qui in
     seguito. I canali fuori da questa tabella mostrano il badge iniziali. */
  logoDomains: {
    "rai1": "rai.it", "rai2": "rai.it", "rai3": "rai.it",
    "canale5": "mediaset.it", "italia1": "mediaset.it", "rete4": "mediaset.it",
    "la7": "la7.it",
    "nove": "nove.tv",
    "realtime": "realtime.it",
    "dmax": "dmax.it",
    "foodnetwork": "foodnetwork.it",
    "srf1": "srf.ch", "srf2": "srf.ch",
    "rsila1": "rsi.ch", "rsila2": "rsi.ch",
    "rts1": "rts.ch", "rts2": "rts.ch"
  }
};
```

(nota: il PIN in questo blocco e gia `"1984"`, cioe il valore lasciato dal Task 2. Se stai eseguendo i task fuori ordine, non sovrascrivere un valore diverso che sia gia stato impostato.)

- [ ] **Step 2: Aggiungi le funzioni di match prima di makeTile**

In `index.html`, tra la fine di `renderGrid()` e l'inizio di `makeTile()` (righe 1106-1108):

```js
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  VIEW.forEach((c, i) => tiles.appendChild(makeTile(c, i)));
  el.grid.appendChild(tiles);
}

function makeTile(c, i){
```

diventa:

```js
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  VIEW.forEach((c, i) => tiles.appendChild(makeTile(c, i)));
  el.grid.appendChild(tiles);
}

function normalizeChannelName(name){
  return String(name || "")
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k|8k)\b/g, "")
    .replace(/\+\d+/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function logoDevUrl(c){
  if (!CFG.logoDevToken) return "";
  const domain = CFG.logoDomains[normalizeChannelName(c.name)];
  return domain ? "https://img.logo.dev/" + domain + "?token=" + CFG.logoDevToken : "";
}

function makeTile(c, i){
```

- [ ] **Step 3: Usa il fallback logo.dev nel rendering della tile**

In `makeTile()`, il blocco del logo (poco dopo l'inizio della funzione):

```js
  const logo = b.querySelector(".logo");
  if (c.logo){
    const img = document.createElement("img");
    img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.alt = "";
    img.src = c.logo;
    img.onerror = () => { logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>'; };
    logo.appendChild(img);
  } else logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>';
```

diventa:

```js
  const logo = b.querySelector(".logo");
  const logoSrc = c.logo || logoDevUrl(c);
  if (logoSrc){
    const img = document.createElement("img");
    img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.alt = "";
    img.src = logoSrc;
    img.onerror = () => { logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>'; };
    logo.appendChild(img);
  } else logo.innerHTML = '<span class="fallback">' + initials(c.name) + '</span>';
```

- [ ] **Step 4: Verifica le funzioni pure con un check isolato**

```bash
node --input-type=module -e '
const CFG = { logoDevToken: "tok_test", logoDomains: { "rai1": "rai.it", "la7": "la7.it" } };
function normalizeChannelName(name){
  return String(name || "").toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k|8k)\b/g, "")
    .replace(/\+\d+/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
function logoDevUrl(c){
  if (!CFG.logoDevToken) return "";
  const domain = CFG.logoDomains[normalizeChannelName(c.name)];
  return domain ? "https://img.logo.dev/" + domain + "?token=" + CFG.logoDevToken : "";
}
const cases = [
  [normalizeChannelName("RAI 1 HD"), "rai1"],
  [normalizeChannelName("La7"), "la7"],
  [logoDevUrl({name:"RAI 1 HD"}), "https://img.logo.dev/rai.it?token=tok_test"],
  [logoDevUrl({name:"Canale Sconosciuto"}), ""]
];
let fail = 0;
for (const [got, want] of cases){
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + JSON.stringify(got) + " atteso " + JSON.stringify(want));
}
process.exit(fail ? 1 : 0);
'
```

Expected: quattro righe `PASS`, codice di uscita `0`.

Non fare commit in questo task: si accorpa al Task 6.

---

## Task 6: Attribuzione, disclaimer README e commit (Incarico loghi)

**Files:**
- Modify: `index.html:464-469` (pannello impostazioni)
- Modify: `README.md:237-241` (sezione 7)

**Interfaces:**
- Consumes: markup del pannello impostazioni dal codice esistente.

- [ ] **Step 1: Aggiungi la riga di attribuzione nel pannello impostazioni**

In `index.html`, tra la riga "Schermo intero Tesla" e `<div class="foot">`:

```html
    <div class="row" style="display:block">
      <div class="rl"><b>Schermo intero Tesla</b><span>Il browser Tesla resta a due terzi di schermo. Passando da un redirect YouTube si apre a pieno schermo. Salva il link generato come segnalibro nell auto.</span></div>
      <input type="text" id="inSite" placeholder="https://catodo.tuodominio.ch" autocomplete="off" spellcheck="false">
      <input type="text" id="outSite" readonly>
    </div>
    <div class="foot">
```

diventa:

```html
    <div class="row" style="display:block">
      <div class="rl"><b>Schermo intero Tesla</b><span>Il browser Tesla resta a due terzi di schermo. Passando da un redirect YouTube si apre a pieno schermo. Salva il link generato come segnalibro nell auto.</span></div>
      <input type="text" id="inSite" placeholder="https://catodo.tuodominio.ch" autocomplete="off" spellcheck="false">
      <input type="text" id="outSite" readonly>
    </div>
    <div class="row" style="display:block">
      <div class="rl"><b>Loghi canale</b><span>Quando la lista non porta un logo, alcune emittenti note lo mostrano recuperandolo da <a href="https://logo.dev" target="_blank" rel="noreferrer">logo.dev</a>. Nomi e loghi restano dei rispettivi editori.</span></div>
    </div>
    <div class="foot">
```

- [ ] **Step 2: Aggiungi il disclaimer nel README, sezione 7**

In `README.md`, tra il paragrafo "Sul contesto" e il paragrafo finale "Infine" (righe 237-243):

```markdown
**Sul contesto.** Tu risiedi in Italia e lavori in Svizzera, quindi valgono le regole italiane
per l uso e quelle del paese di hosting per il sito. In Italia AGCOM ha poteri molto incisivi
sui servizi che diffondono contenuti, ma quelli riguardano chi distribuisce: una pagina privata
protetta da password, per uso personale, senza contenuti propri, e un altro pianeta. Il fatto
che sia dietro autenticazione e con `noindex` non e solo igiene, e parte della posizione.

Infine: il browser della Tesla riproduce video solo a veicolo fermo, che e esattamente il modo
in cui questa cosa va usata.
```

diventa:

```markdown
**Sul contesto.** Tu risiedi in Italia e lavori in Svizzera, quindi valgono le regole italiane
per l uso e quelle del paese di hosting per il sito. In Italia AGCOM ha poteri molto incisivi
sui servizi che diffondono contenuti, ma quelli riguardano chi distribuisce: una pagina privata
protetta da password, per uso personale, senza contenuti propri, e un altro pianeta. Il fatto
che sia dietro autenticazione e con `noindex` non e solo igiene, e parte della posizione.

**Sui loghi.** Quando la playlist non fornisce un logo canale, alcune emittenti note lo mostrano
recuperandolo al volo da [logo.dev](https://logo.dev): CATODO non salva ne ospita quei file, li
richiede il browser di chi guarda, ogni volta. Nomi e loghi restano marchi delle rispettive
emittenti, CATODO non ne e affiliato.

Infine: il browser della Tesla riproduce video solo a veicolo fermo, che e esattamente il modo
in cui questa cosa va usata.
```

- [ ] **Step 3: Commit**

```bash
git add index.html README.md
git commit -m "$(cat <<'EOF'
feat: loghi canale via logo.dev con tabella dominio curata

Per i canali senza tvg-logo nella lista M3U, una tabella statica
nome canale normalizzato -> dominio prova a recuperare il logo da
logo.dev in tempo reale. Nessuna immagine salvata o ospitata da
CATODO: coerente con la regola che il progetto non ridistribuisce
contenuti. Attribuzione in impostazioni, disclaimer nel README.
EOF
)"
```

---

## Task 7: Verifica finale in browser reale

**Files:** nessuno (task di verifica, non di codice).

**Interfaces:**
- Consumes: `index.html` completo dai Task 2, 5, 6.

- [ ] **Step 1: Chiedi all'utente il token logo.dev**

Chiedi all'utente di registrarsi su logo.dev (gratuito, tu non puoi crearlo per lui) e di darti il publishable token. Incollalo in `index.html`, campo `CFG.logoDevToken`. Non fare commit di questo cambio se contiene un token reale fornito dall'utente per test locali: chiedi prima se va bene versionarlo (e un token pubblicabile, non segreto, ma la scelta resta sua).

- [ ] **Step 2: Apri index.html nel browser**

Usa lo strumento Browser per aprire `file:///Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/catodo/index.html`.

- [ ] **Step 3: Salta la cartolina di prova**

Clicca sulla cartolina per saltare l'animazione introduttiva.

- [ ] **Step 4: Inserisci il PIN**

Digita `1984` sul tastierino. Verifica che la schermata di accesso sparisca.

- [ ] **Step 5: Carica una lista M3U reale**

Se si apre la schermata sorgenti, clicca "USA QUESTA" sulla voce "Free-TV / IPTV", poi "CARICA". Aspetta il caricamento.

- [ ] **Step 6: Verifica la griglia canali**

Controlla che appaiano dei canali con nome, categoria colorata e numero. Cerca un canale che corrisponda a una voce di `CFG.logoDomains` (es. "Rai 1" o "La7"): verifica nell'inspector di rete che parta una richiesta verso `img.logo.dev`. Cerca un canale fuori tabella e senza `tvg-logo`: verifica che mostri il badge con le iniziali, non un'immagine rotta.

- [ ] **Step 7: Apri un canale e zappa**

Clicca su un canale riproducibile. Verifica che parta la riproduzione (o quantomeno che il player tenti la connessione, dipende dalla rete disponibile). Usa i paddle `◀ CH` / `CH ▶` per cambiare canale avanti e indietro.

- [ ] **Step 8: Chiudi**

Chiudi il player e torna alla griglia. Fai uno screenshot finale come prova.

- [ ] **Step 9: Riepiloga all'utente cosa resta fuori da questo piano**

Comunica chiaramente che:
- `index.html` e `worker.js` aggiornati sono committati e pushati su GitHub, ma non ancora ricaricati sul sito live (quello resta con la versione precedente finche non viene fatto un deploy, oggi solo manuale).
- Il redeploy del Worker su Cloudflare resta un passo manuale da dashboard.
- `deploy.mjs` (Incarico 2, caricamento automatico di `index.html`/`.htaccess`/`robots.txt`) non e stato ancora scritto: e lavoro futuro, fuori da questo piano.

---

## Self-Review

- **Copertura spec:** PIN (Task 1-2), test automatico (Task 1), Basic Auth + header di sicurezza + robots.txt + ALLOW_ORIGIN (Task 3-4), README aggiornato (Task 3, 6), loghi via logo.dev con tabella curata e attribuzione (Task 5-6), verifica browser reale (Task 7). Nessuna sezione dello spec senza task corrispondente.
- **Placeholder:** nessuno, ogni step ha codice completo o comandi esatti con output atteso.
- **Coerenza dei nomi:** `normalizeChannelName`, `logoDevUrl`, `CFG.logoDevToken`, `CFG.logoDomains` usati in modo identico nel Task 5 e nel Task 7. `gen-htpasswd.mjs` e `npm run gen:htpasswd` coerenti tra Task 3 e Task 4.
- **Deploy.mjs:** volutamente fuori scope, come da spec approvato. Segnalato esplicitamente all'utente nel Task 7 per evitare l'impressione che il sito live sia gia aggiornato.

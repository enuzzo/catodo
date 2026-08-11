# CATODO: brief operativo

Questa cartella contiene un progetto finito e funzionante. Non riscriverlo, non introdurre framework,
non aggiungere un passaggio di build. Ci sono quattro incarichi precisi, in fondo.

---

## Che cosa e

Un ricevitore IPTV privato che gira dentro il browser della Tesla, a veicolo fermo.
Un solo file HTML, nessun backend, nessuna dipendenza a parte hls.js da CDN.
Lo usa una persona sola, il proprietario dell auto.

I canali arrivano dalla playlist pubblica `Free-TV/IPTV`, che raccoglie solo emittenti
dichiarate free-to-air. Nessun flusso e ospitato qui: la pagina punta agli stessi URL
che useresti in VLC.

### Vincoli tecnici da rispettare

Sono la ragione per cui il codice e fatto cosi. Non "modernizzarlo".

- **Il browser Tesla e Chromium 88.** User agent `Tesla/<firmware>`. Niente `:has()`,
  niente container queries, niente sintassi oltre ES2016. Se aggiungi codice, resta in quel
  perimetro o rompi il bersaglio.
- **Niente HLS nativo.** Chromium ha il demuxer HLS solo dalla 142. Serve per forza
  hls.js su Media Source Extensions. Non sostituirlo con Video.js o Shaka: sono piu pesanti
  e girano comunque su hls.js.
- **CORS e mixed content sono il problema vero.** hls.js scarica manifest, varianti, segmenti
  e chiavi via XHR: ogni richiesta e cross-origin. Un flusso che va in VLC puo non andare nel
  browser. In piu 109 canali del sottoinsieme utile sono in `http://` e una pagina https li
  blocca. Per questo esiste `worker.js`.
- **Tutto deve essere leggibile e toccabile da fermi in auto.** Target minimo 72 px,
  niente stati hover, contrasto alto.
- **Nella lingua dell interfaccia e in qualunque testo scritto: mai trattini lunghi o medi.**
  Usa virgole, parentesi, due punti o trattini corti. Vale anche per commenti, README e
  messaggi di commit.

### Identita

Il nome viene dal tubo a raggi catodici. Le sette barre colore EBU sono il sistema:
ogni categoria di canali prende una barra e se la tiene ovunque (colonna, scheda, numero a
video, filo sopra la barra di sintonia). Il fondo e `#0C0D0B`, il verde-nero caldo del vetro
di un tubo spento. Se tocchi la grafica, resta dentro questo sistema.

### File

```
index.html           il player. Autosufficiente, arriva senza nessuna lista dentro.
worker.js            proxy Cloudflare per CORS, mixed content e hotlink. NON va sull FTP.
check-playlist.mjs   diagnosi locale di una lista M3U. Stampa a schermo, non scrive file.
README.md            documentazione completa, leggila prima di toccare qualsiasi cosa
```

---

## Regola di fondo: CATODO non distribuisce niente

Questa e la scelta architetturale piu importante del progetto e non va annullata per comodita.

Il prodotto arriva **vuoto**. Non contiene liste, non ospita flussi, non fa da tramite. Le
liste M3U le carica chi lo usa, da URL o da file, e restano nel suo browser. La schermata
sorgenti rimanda a progetti indipendenti di terzi, ma sono collegamenti, non contenuti.

Concretamente, mentre lavori:

- **Non reintrodurre `channels.json`**, ne alcun altro file di canali dentro il repo. Una copia
  filtrata di una playlist pubblica resta una ridistribuzione, anche se la fonte e pubblica.
- **Non aggiungere sorgenti precaricate** in `CFG.directory` che si carichino da sole al primo
  avvio. Quell elenco descrive dove cercare, e l utente decide.
- **Non mettere in cache le liste lato server** ne dentro il Worker. Il Worker inoltra e basta.
- `check-playlist.mjs` e uno strumento di diagnosi locale: stampa a schermo e non deve mai
  scrivere file di canali destinati al repo o all FTP.
- Se una modifica ti sembra comoda ma finisce col far distribuire contenuti al progetto,
  fermati e chiedi.

Il ragionamento completo sta in `README.md`, sezione 7.

---

## Incarico 1: git e GitHub

Inizializza il repo e pubblicalo su GitHub **privato**.

**Ordine obbligatorio.** Scrivi `.gitignore` **prima** del primo `git add`. Se una credenziale
finisce anche in un solo commit, resta nella cronologia per sempre e va riscritta la storia.

`.gitignore` deve coprire almeno:

```
.env
.env.*
!.env.example
node_modules/
.DS_Store
*.log
deploy/
```

Poi: init, primo commit, repo privato su GitHub via `gh repo create`, push.
Nome suggerito: `catodo`. Descrizione: ricevitore IPTV privato per il browser Tesla.

Prima di pubblicare, verifica con `git log -p` che nel diff non compaiano host, utenti o
password. Se il repo era gia stato inizializzato altrove, controlla anche quello.

---

## Incarico 2: deploy via FTP

Il sito va su un hosting classico raggiungibile in FTP.

**Prepara `.env.example`** (questo si, versionato) con i nomi delle variabili e nessun valore:

```
FTP_HOST=
FTP_PORT=21
FTP_USER=
FTP_PASSWORD=
FTP_SECURE=true          # FTPS. Metti false solo se l hosting non lo supporta
FTP_REMOTE_DIR=/         # cartella di destinazione sul server
SITE_URL=                # indirizzo pubblico, serve per il link schermo intero Tesla
```

**Poi crea `.env`** con le stesse chiavi vuote, gia ignorato da git, e **dimmi esplicitamente
di riempirlo io**. Non inventare valori, non chiedermeli in chat, non scriverli da nessuna
altra parte.

**Scrivi `deploy.mjs`**, coerente con `check-playlist.mjs` che c e gia (Node, ESM, nessun
transpiler). Usa `basic-ftp`. Requisiti:

- carica **solo** `index.html`, `.htaccess`, `robots.txt`
- non caricare mai `.env`, `worker.js`, `check-playlist.mjs`, `node_modules`, `.git`
- se `FTP_SECURE=true` usa FTPS esplicito, e fallisci con un messaggio chiaro se il server
  non lo offre, invece di ripiegare in chiaro senza dirlo
- verifica che tutte le variabili esistano prima di connettersi, e spiega quale manca
- stampa cosa ha caricato e quanti byte
- aggiungi lo script in `package.json` come `npm run deploy`

Nel README, aggiungi una sezione breve sul deploy. Segnala per iscritto che **FTP semplice
manda le credenziali in chiaro** e che se l hosting offre SFTP o FTPS va usato quello.

---

## Incarico 3: il PIN non funziona, e so perche

Il proprietario riferisce che il codice corretto viene rifiutato. Ho gia isolato la causa
eseguendo la pagina in jsdom su dieci scenari. **Non ripartire da zero con l indagine.**

Risultati: il flusso funziona con il PIN di default, da tastierino, da tastiera fisica, con
digitazione rapida, con conferma OK, con PIN a sei cifre e aperto da `file://`.
Fallisce in due casi, entrambi provocati dalla modifica di quella riga:

1. **`pin: 0712`** (numero con zero iniziale, senza virgolette)
   Genera `SyntaxError: Octal literals are not allowed in strict mode`. L intero script muore
   al parsing, quindi la pagina resta ferma sulla cartolina di prova e non risponde a niente.
2. **`pin: "1957 "`** (spazio finale, tipico da copia e incolla)
   Nessun errore, nessun avviso: il confronto non torna mai e il codice giusto viene sempre
   rifiutato. Questo e il sintomo descritto.

**Il difetto vero non e il valore, e il confronto.** In `index.html`, dentro `buildGate()`:

```js
const submit = () => {
  if (buf === String(CFG.pin)) { ... }
```

Rendilo tollerante e non silenzioso:

- normalizza entrambi i lati con `String(...).trim()`
- all avvio, valida `CFG.pin`: se contiene caratteri non numerici o e vuoto, mostra un
  messaggio esplicito nella schermata di accesso invece di rifiutare in silenzio, perche
  il tastierino puo produrre solo cifre e un PIN non digitabile e un vicolo cieco
- il numero di pallini deve seguire la lunghezza reale del PIN, non essere fisso a quattro
- nel commento accanto a `pin:` scrivi che il valore va **sempre fra virgolette**

Verifica il risultato con un test automatico, non a occhio: c e gia il precedente in
`check-playlist.mjs` di script Node autonomi. Copri almeno i due casi qui sopra.

---

## Incarico 4: la sicurezza, fatta sul serio

Va detto chiaramente e va scritto nel README: **un PIN dentro un file HTML pubblico non e
protezione.** Chiunque apra il sorgente lo legge in cinque secondi. Il repo e privato, ma il
sito no: e quello che conta.

Il PIN resta, ma cambia ruolo: diventa la schermata di blocco che impedisce a un passeggero
di finirci dentro toccando lo schermo dell auto. La barriera vera si mette davanti.

**Dato che il deploy e su FTP, la soluzione giusta e HTTP Basic Auth via `.htaccess`.**

- genera `.htaccess` e `.htpasswd` (bcrypt, non crypt)
- `.htpasswd` fuori dalla document root se l hosting lo permette, altrimenti dentro ma con
  accesso negato via `<Files>`
- il file di password non va in git: aggiungilo a `.gitignore` e fornisci invece un piccolo
  comando che lo genera dalle variabili in `.env`
- verifica prima che l hosting sia Apache con `AllowOverride` attivo. Se e nginx, il file
  non ha alcun effetto e va detto invece di lasciarlo li a dare falsa sicurezza
- forza https e aggiungi `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`
- aggiungi `robots.txt` con `Disallow: /`, in aggiunta al meta `noindex` gia presente

**Altre due cose da sistemare:**

- In `worker.js` la costante `ALLOW_ORIGIN` e a `*`. Va portata al dominio reale del sito,
  altrimenti chiunque scopra l indirizzo del worker ha un proxy aperto gratuito a spese del
  proprietario. Prendi il valore da `SITE_URL`.
- Se in futuro il dominio passa su Cloudflare, la protezione migliore diventa Cloudflare
  Access con policy sulla mail: gratis fino a 50 utenti, sessione lunga a piacere, nessuna
  password nel repo. Annotalo nel README come percorso di aggiornamento, non farlo adesso.

---

## Come voglio il lavoro

Procedi in quest ordine: `.gitignore` e repo, poi il bug del PIN, poi sicurezza, poi deploy.
Fai un commit separato e leggibile per ogni incarico.

Prima di dichiarare finito: apri `index.html` in un browser vero, entra col PIN, carica una lista dalla
schermata sorgenti, apri un canale, zappa avanti e indietro, chiudi. Se una di queste cose non funziona, il
lavoro non e finito.

Fermati e chiedi prima di: cambiare il motore di riproduzione, aggiungere dipendenze runtime,
toccare la palette o la struttura dell interfaccia, eseguire un deploy vero.

# CATODO: PIN, sicurezza vera, loghi canale

Data: 2026-08-11
Stato: approvato, in attesa di piano di implementazione

## Contesto

`BRIEF.md` elenca quattro incarichi. Il repo e il deploy FTP sono gia stati
messi in sicurezza (Incarico 1, gitignore/repo/verifica segreti). Questo spec
copre il resto del lavoro concordato in conversazione:

- Incarico 3 (bug del PIN): il codice del gate risultava gia corretto a una
  lettura riga per riga (`index.html`, `buildGate()`, righe ~651-704).
  Confermato: virgolette obbligate con commento esplicativo (righe 484-486),
  validazione `/^[0-9]{1,8}$/` con messaggio d'errore se il PIN non e valido,
  confronto `buf.trim() === PIN` con `PIN` gia trimmato al caricamento,
  numero di pallini generato dinamicamente sulla lunghezza reale del PIN.
  Resta da fare solo il cambio valore e il test automatico che il brief
  richiede esplicitamente ("verifica con un test automatico, non a occhio").
- Incarico 4 (sicurezza vera): il PIN nell'HTML non e protezione, la
  barriera va messa davanti via HTTP Basic Auth, dato che il deploy e su
  hosting FTP classico (SiteGround, Apache).
- Feature nuova, emersa in conversazione: loghi canale via logo.dev per i
  canali che non hanno `tvg-logo` nella playlist M3U caricata dall'utente.

Vincoli di progetto che restano validi per tutto questo lavoro (da
`BRIEF.md`): niente framework, niente passaggio di build, ES2016 max,
CATODO non ridistribuisce contenuti/liste/loghi propri, trattini lunghi o
medi vietati in ogni testo scritto (README, commenti, commit).

## 1. PIN

**Cambio valore.** `CFG.pin` passa da `"1957"` a `"1984"` in `index.html`
(riga 489). Nessun'altra modifica al codice del gate: la logica esistente
gia gestisce entrambi i casi difettosi descritti nel brief (numero ottale
non quotato, spazio finale da copia e incolla).

**Test automatico.** Nuovo file `test-pin.mjs` (Node, ESM, jsdom come
dipendenza di sviluppo), stesso stile indipendente di `check-playlist.mjs`.
Carica `index.html` in jsdom e verifica, stampando PASS/FAIL per ciascun
caso ed uscendo con codice diverso da zero se qualcosa fallisce:

1. PIN corretto digitato cifra per cifra sblocca il gate (`boot()` chiamata).
2. `pin: 0712` scritto senza virgolette nel sorgente genera
   `SyntaxError: Octal literals are not allowed in strict mode` al
   caricamento della pagina (verifica che il caso resti rotto se qualcuno
   toglie le virgolette, cioe che il commento di avviso abbia ancora senso).
3. `CFG.pin = "1984 "` (spazio finale) accetta comunque `1984` digitato dal
   tastierino.
4. PIN sbagliato viene rifiutato (nessun accesso, `boot()` non chiamata).
5. Il numero di pallini generati corrisponde alla lunghezza del PIN
   configurato (verifica con un PIN di lunghezza diversa da 4, es. `"12"`).

## 2. Sicurezza vera (HTTP Basic Auth via .htaccess)

**Variabili nuove in `.env.example` / `.env`:**

```
HTPASSWD_USER=
HTPASSWD_PASSWORD=
```

Separate da `FTP_USER`/`FTP_PASSWORD`: il login del sito non deve coincidere
con le credenziali di deploy.

**`gen-htpasswd.mjs`.** Script Node locale (ESM, nessun transpiler) che:

- legge `HTPASSWD_USER`/`HTPASSWD_PASSWORD` da `.env`, fallisce con messaggio
  chiaro se mancano
- genera l'hash con `bcryptjs` (pura JS, nessuna compilazione nativa,
  coerente con "nessuna dipendenza pesante")
- scrive `.htpasswd` in locale, file aggiunto a `.gitignore`, mai caricato
  da `deploy.mjs`
- va lanciato manualmente (`node gen-htpasswd.mjs`) ogni volta che la
  password cambia; l'upload del file resta un passo separato e consapevole,
  non automatico dentro `deploy.mjs`

**`.htaccess`.** Contenuto:

- `AuthType Basic`, `AuthName` generico (no info sul progetto), `AuthUserFile`
  che punta a `.htpasswd` nella stessa cartella (l'account FTP e chroottato
  esattamente sulla document root, verificato in sessione precedente: non
  esiste un "fuori" raggiungibile via FTP), con blocco esplicito
  dell'accesso diretto al file:
  ```
  <Files ".htpasswd">
    Require all denied
  </Files>
  ```
- redirect forzato a https (`RewriteCond %{HTTPS} off` + `RewriteRule`)
- header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`

**Verifica reale (non teorica).** Upload di un `.htaccess` di prova via FTP,
poi controllo con curl che il sito risponda `401` senza credenziali e `200`
con le credenziali corrette, prima di considerare la protezione attiva. Se
la risposta non cambia, l'hosting non applica `AllowOverride` (o e nginx) e
va detto chiaramente invece di lasciare un file che non fa nulla.

**`robots.txt`.** Nuovo file, `Disallow: /`, in aggiunta al meta `noindex`
gia presente in `index.html` (da confermare in fase di implementazione).

**`worker.js`.** `ALLOW_ORIGIN` da `"*"` a `"https://catodo.netmilk.dev"`.
Il file viene aggiornato nel repo; il deploy del Worker su Cloudflare resta
un passo manuale da dashboard (incolla e Deploy), come gia documentato in
`README.md`: nessun accesso API a Cloudflare in questa sessione.

## 3. Loghi canale via logo.dev

**Principio guida (dalla discussione):** nessuna immagine di logo viene mai
posseduta o servita da CATODO. Solo testo (nome canale -> dominio); il file
immagine lo serve sempre logo.dev, dal browser di chi guarda, con la sua
cache di 24 ore (`Cache-Control: max-age=86400, stale-while-revalidate=600`,
verificato). Stesso principio con cui CATODO non ospita playlist o flussi.

**`CFG.logoDevToken`** in `index.html`: token pubblicabile di logo.dev
(pensato per stare lato client, non un segreto). Il proprietario si registra
da solo su logo.dev (io non posso creare account per lui) e fornisce il
token, che va incollato direttamente nel file, non in `.env` (CATODO non ha
passaggio di build: tutto cio che serve al client deve stare nell'HTML).

**`CFG.logoDomains`**: oggetto nome-canale-normalizzato -> dominio, curato a
mano, punto di partenza con le principali emittenti italiane e svizzere
(Rai 1/2/3, Canale 5, Italia 1, Rete 4, La7, La7d, TV8, Real Time, DMAX,
Nove, Cielo, SRF 1/2, RSI LA1/LA2, RTS 1/2, ...). Elenco esplicitamente non
esaustivo, estendibile in seguito modificando quell'oggetto.

**Normalizzazione e match.** Funzione che riduce il nome canale a
minuscolo, rimuove suffissi di qualita/variante comuni (`HD`, `FHD`, `4K`,
`SD`, `+1`, numeri di ripetizione), e cerca il risultato nella tabella. Match
esatto sul nome normalizzato; se non trovato, nessun tentativo euristico sul
dominio (deciso esplicitamente in conversazione: solo tabella curata, mai
indovinare un dominio).

**Uso nella griglia.** In `makeTile()`: se `c.logo` e assente, prova il
match; se trovato, `src="https://img.logo.dev/<dominio>?token=<CFG.logoDevToken>"`
con lo stesso `onerror` di fallback al badge iniziali gia esistente. Nessun
cambiamento per i canali che arrivano gia con `tvg-logo` dalla playlist.

**Attribuzione.** Riga "Loghi forniti da logo.dev" con link, nel pannello
impostazioni (non nella UI di visualizzazione principale, per restare
leggibile da fermi in auto), richiesta dal piano gratuito di logo.dev.

**Disclaimer.** Una riga in `README.md`: nomi e loghi dei canali
appartengono alle rispettive emittenti, CATODO non e affiliato e non li
ospita.

**Volume atteso.** Uso privato, singolo dispositivo, tabella curata di
poche decine di voci, cache 24 ore lato browser: stima nell'ordine di
migliaia di chiamate al mese contro un limite gratuito di 500.000. Nessun
rischio di superare il piano free.

## Testing prima di dichiarare finito

- `test-pin.mjs` automatico, obbligatorio, deve passare prima del commit
  dell'Incarico 3.
- Verifica manuale in browser reale (non solo jsdom): apertura, PIN,
  caricamento di una lista M3U vera dalla schermata sorgenti, controllo che
  un canale in tabella mostri il logo da logo.dev e uno fuori tabella mostri
  le iniziali, apertura canale, zapping avanti e indietro, chiusura.
- Verifica separata via curl sul sito live: `401` senza credenziali Basic
  Auth, `200` con credenziali corrette.

## Ordine di lavoro e commit

Tre commit separati e leggibili, in quest'ordine:

1. PIN: valore aggiornato + `test-pin.mjs`
2. Sicurezza: `.htaccess`, `gen-htpasswd.mjs`, `robots.txt`, `worker.js`,
   variabili `.env.example`
3. Loghi canale: `CFG.logoDevToken`, `CFG.logoDomains`, logica di match in
   `makeTile()`, riga di attribuzione, disclaimer README

`deploy.mjs` (Incarico 2) resta fuori da questo spec: non ancora richiesto
in questa sessione.

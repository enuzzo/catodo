# CATODO

Ricevitore IPTV privato per il browser della Tesla. Un file HTML, zero framework, zero backend.

Sorgente canali: `Free-TV/IPTV`, playlist di soli canali dichiarati free-to-air.
Nessun flusso viene ospitato qui: la pagina punta agli stessi URL pubblici che useresti in VLC.

---

## 1. Cosa ho verificato prima di scrivere il codice

### Il browser della Tesla

E Chromium, non Safari. Gli user agent raccolti mostrano `Chromium/88` con suffisso `Tesla/<versione firmware>`.
Due conseguenze pratiche:

- **Niente HLS nativo.** Chromium ha aggiunto il demuxer HLS solo dalla versione 142. Su un motore 88 il tag `<video src="...m3u8">` non fa nulla. Serve per forza una libreria su Media Source Extensions.
- **Motore vecchio.** Niente `container queries`, niente `:has()`, prudenza con la sintassi moderna. Il codice qui dentro sta su ES2016 e CSS che gira dal 2020.

### Il player

Ho guardato hls.js, Video.js, Shaka Player, Vidstack, Plyr e mpegts.js.

| | verdetto |
|---|---|
| **hls.js** | **scelto.** E il motore che sta sotto quasi tutti gli altri. Nessuna UI da combattere, controllo diretto sugli errori, bundle ~90 KB gzip. Requisito unico: MSE con mime `video/MP4`, che il Chromium 88 della Tesla ha. |
| Video.js | ottimo per VOD brandizzato, ma trascina un tema pesante e usa comunque hls.js sotto. Peso inutile sulla SIM dell auto. |
| Shaka Player | eccellente su DASH e DRM. Qui non serve DRM e il bundle e piu grosso. |
| Vidstack, Plyr | UI belle ma pensate per mouse e desktop. I target touch sono troppo piccoli per uno schermo d auto. |
| mpegts.js | serve solo per i flussi `.ts` grezzi: nella playlist sono 7 canali su 1930. Non vale la dipendenza. |

Gestione errori: il player prova due volte in rete, due volte a recuperare il decoder, poi passa al canale successivo. In auto, con la copertura che va e viene, questo e quello che fa la differenza tra "funziona" e "non funziona".

### Lo schermo intero

Il browser Tesla occupa due terzi dello schermo e la Fullscreen API non lo allarga: allarga il video dentro quella finestra.
Il metodo che la comunita usa da anni (Channels DVR lo documenta ufficialmente, e ABetterTheater e Fullscreen Hub sono costruiti sopra) e passare da un redirect YouTube: il sistema apre la webview dell app YouTube, che e a schermo pieno, e poi la reindirizza al tuo sito.

```
https://www.youtube.com/redirect?q=https://tuo-catodo.pages.dev
```

Nell auto: incolla, tocca "vai al sito", salva come segnalibro. Il campo nelle impostazioni di Catodo ti genera questo link gia pronto.
Nota onesta: e un comportamento non documentato, alcuni firmware lo hanno bloccato e poi ripristinato. Se un giorno smette, il player funziona lo stesso, solo in finestra.

### I due muri veri: CORS e mixed content

Sono la ragione per cui la maggior parte dei player IPTV nel browser "non va", e nessuno lo spiega.

1. **CORS.** hls.js scarica il manifest, ogni variante, ogni segmento e ogni chiave AES via XHR. Ognuna di quelle richieste e cross-origin e il browser la blocca se il server non manda `Access-Control-Allow-Origin`. Sistemare solo il manifest non basta: la riproduzione parte e muore al primo segmento. Un flusso che va in VLC puo benissimo non andare nel browser: VLC di CORS non sa nulla.
2. **Mixed content.** Nella playlist ci sono 257 canali su `http://`. Una pagina servita in https non puo caricarli, Chromium li blocca e basta. Nel sottoinsieme che ti interessa sono 109.

Entrambi si risolvono con lo stesso pezzo: `worker.js`, un Cloudflare Worker che rifa la richiesta lato server, aggiunge gli header CORS, riscrive la playlist perche anche i segmenti ripassino da li, e chiude il salto http verso https. Gratis fino a 100.000 richieste al giorno.

### Cosa aspettarsi da una lista pubblica

Passando la lista Free-TV in `check-playlist.mjs`: 1930 voci, 1918 uniche.
1576 aprono nel browser cosi come sono, 257 sono in `http` e servono il proxy,
85 non apriranno mai (72 YouTube, 6 RTMP, 4 Twitch, 3 Dailymotion).

Vale per qualunque lista: circa un canale su sette non e utilizzabile in un browser,
e il numero non c entra con la qualita della fonte. E il motivo per cui `check-playlist.mjs`
esiste.

Due cose da tenere a mente quando scegli:

- **Geoblocco.** Molti canali nazionali guardano l indirizzo IP. In auto la SIM Tesla puo darti
  un indirizzo italiano o svizzero a seconda della rete agganciata, e lo stesso canale si comporta
  in modo diverso da un giorno all altro.
- **Provenienza.** In qualunque lista pubblica possono finire flussi che non arrivano dal
  broadcaster ma da pannelli di rivendita. Si riconoscono: indirizzi IP nudi con porte alte,
  percorsi tipo `/utente/password/12345`. Non sono free-to-air, e vanno tolti.

---

## 2. File

```
index.html           il player. Arriva senza nessuna lista dentro.
worker.js            proxy Cloudflare per CORS, mixed content e hotlink. Non va sull FTP.
check-playlist.mjs   diagnostica: dice quali canali di una tua lista apriranno nel browser
README.md            questo file
BRIEF.md             incarichi aperti, per chi ci lavora
```

---

## 3. Messa in strada

### Passo 1: il PIN

In `index.html`, riga ~660:

```js
const CFG = {
  pin: "1957",     // cambialo
```

### Passo 2: repo privata + Cloudflare Pages

GitHub Pages da repo privata richiede un piano a pagamento. Cloudflare Pages no, ed e anche piu vicino come rete.

```
repo privata su GitHub, push dei file
dash.cloudflare.com > Workers & Pages > Create > Pages > Connect to Git
build command: (vuoto)     output directory: /
```

Esce un `https://catodo-xxx.pages.dev`. Se preferisci, ci punti un sottodominio tuo.

### Passo 3: protezione seria

Il PIN nella pagina e comodita, non sicurezza: chi apre il sorgente lo legge. Va benissimo per tenere fuori chi ci capita sopra, ma la barriera vera si mette prima:

```
Cloudflare > Zero Trust > Access > Applications > Add > Self-hosted
dominio: catodo-xxx.pages.dev
policy: Allow > Emails > la tua mail
```

Gratis fino a 50 utenti. Chiede un codice via mail al primo accesso e poi tiene la sessione per il periodo che imposti: metti 30 giorni e in auto non lo rivedi quasi mai. Alternativa piu spiccia: policy su intervallo IP, o direttamente `Cloudflare Access Service Token`.

### Passo 4: il proxy

```
Workers & Pages > Create > Worker
incolla worker.js > Deploy
```

Poi in `worker.js` metti `ALLOW_ORIGIN` sul tuo dominio reale invece di `*`, altrimenti chiunque scopra l URL ha un proxy gratis.
Copia l indirizzo del worker nelle impostazioni di Catodo. Da quel momento i canali marcati `HTTP` diventano apribili e quelli che davano errore CORS partono.

### Passo 5: le liste

Non ce ne sono da preparare. Al primo avvio CATODO apre la schermata sorgenti e ti chiede
di caricarne una. Dentro trovi un elenco ragionato di progetti pubblici indipendenti da cui
partire, con un pulsante che ti riempie il campo. Le liste vengono scaricate dal browser
direttamente dal loro server e messe in cache locale per dodici ore.

Per capire cosa vale la pena tenere in una lista, prima di caricarla:

```
node check-playlist.mjs https://.../lista.m3u
node check-playlist.mjs https://.../lista.m3u --deep --csv
```

Ti dice quanti canali apriranno nel browser cosi come sono, quanti servono il proxy e quanti
sono irrecuperabili. Con `--deep` scarica davvero i manifest e verifica gli header CORS.

### Passo 6: in macchina

1. Parcheggiata. Il video parte solo in P.
2. Browser, incolla il link YouTube redirect generato dalle impostazioni.
3. "Vai al sito", poi segnalibro.
4. PIN, categoria, canale.

---

## 4. Identita

Il nome viene dal tubo a raggi catodici. Tutto il resto scende da li.

**Le barre colore EBU.** Sette valori normati (bianco, giallo, ciano, verde, magenta, rosso, blu) usati come sistema, non come decoro: ogni categoria di canali prende una barra e se la tiene ovunque, nella colonna, nel bordo della scheda, nel numero a video, nel filo sopra la barra di sintonia. Italia verde, Svizzera rossa, film magenta, news ciano. Il colore ti dice dove sei prima che tu legga.

**Il fondo non e nero.** E `#0C0D0B`, il verde-nero caldo del vetro di un tubo spento. E il bianco non e bianco, e `#F0EBE1`. Un televisore acceso di notte non ha mai avuto un nero puro.

**La cartolina di prova.** All apertura le sette barre calano una dopo l altra, il logotipo compare sulla fascia nera, poi tutto collassa. Dura poco piu di un secondo e si salta toccando lo schermo.

**Lo spegnimento.** Quando chiudi un canale l immagine si schiaccia in una riga orizzontale, sbianca e sparisce in un punto. E il comportamento fisico dell oggetto da cui il software prende il nome, e costa quattro keyframe CSS.

**L errore di convergenza.** Il logotipo ha un filo di rosso a destra e di ciano a sinistra, come un tubo mal registrato. Solo il logotipo, mai il testo corrente.

**L effetto catodico** e spento di default e si accende dal tasto durante la visione o dalle impostazioni: righe di scansione, maschera fosfori RGB e vignettatura. Bello, ma toglie nitidezza davvero, quindi la scelta resta tua ogni volta.

**L orologio in testata** e in formato Televideo (`MAR 11 AGO 17:42`), che in auto serve piu di quanto sembri.

## 5. Come e fatta l interfaccia

Non e una griglia stile Netflix, e un sintonizzatore. La differenza conta perche in auto non stai sfogliando un catalogo: stai zappando.

- **Barra di sintonia in basso.** Numero canale su blocco pieno del colore della categoria, nome, risoluzione reale negoziata da hls.js e un indicatore di segnale che legge la stima di banda vera, rosso quando sei sotto. Su LTE ballerino vedi il problema prima di subirlo.
- **Numero a video.** Quando zappi compare in alto a sinistra il numero su fondo colorato e il nome del canale, per due secondi e mezzo. E l OSD dei televisori degli anni Novanta e fa esattamente il lavoro che faceva allora.
- **Paddle `◀ CH` e `CH ▶` da 112 px.** Zapping ciclico dentro la categoria corrente, salta da solo i canali non riproducibili e riparte dall inizio in fondo alla lista. Si toccano senza guardare.
- **Target minimo 72 px** ovunque, perche uno schermo da 15 pollici a mezzo metro con il dito non e un mouse.
- **Overlay che spariscono** dopo 4 secondi, un tocco li richiama.
- **Adatta / riempi**, perche il 15,4" della Highland e piu largo del 16:9 e certi canali SD sono in 4:3.
- **Qualita limitata alla finestra** attiva di default: non scarica 1080p per riempire mezzo schermo. Sulla SIM dell auto e la voce di consumo piu grossa.
- **Canali non apribili** marcati `HTTP`, `YT`, `RTMP` invece che nascosti in silenzio, cosi sai perche mancano.

Preferiti e cronologia stanno in `localStorage` con fallback in memoria: se il browser blocca lo storage la pagina non si rompe, perde solo la memoria tra una sessione e l altra.

---

## 6. Se qualcosa non parte

| sintomo | causa | cosa fare |
|---|---|---|
| `FLUSSO BLOCCATO (CORS O OFFLINE)` | il server non manda gli header CORS | attiva il proxy |
| il canale ha il badge `HTTP` | mixed content | attiva il proxy |
| errore 403 solo su un canale | hotlink protection | aggiungi l host in `RULES` dentro `worker.js` con Referer e Origin giusti |
| `CODEC NON SUPPORTATO` | il flusso e HEVC o AC-3 | non risolvibile lato browser, e una mancanza del decoder |
| canale con badge `GEO` che non parte | geoblocco sull IP della SIM | dipende da dove ti trova la rete Tesla |
| tutto nero ma l audio va | raro sui Chromium vecchi | tocca "riempi schermo", forza un ridisegno |
| la lista non si carica | GitHub raw irraggiungibile | `channels.json` locale copre questo caso |

---

## 7. La posizione legale

Non sono un avvocato e questo non e un parere legale. Ma l architettura e stata scelta per
tenere il progetto dalla parte semplice della questione, e vale la pena capire perche.

**CATODO e un lettore, non un catalogo.** Non contiene liste, non ospita flussi, non fa da
tramite fra chi guarda e chi trasmette. E la stessa categoria di VLC, Kodi o IPTVnator:
software neutro, che diventa utile solo quando l utente gli da un contenuto suo.

**Non ridistribuiamo niente.** La prima versione di questo progetto includeva una copia
filtrata della playlist Free-TV dentro il repo. Anche se il file a monte e pubblico, quella
copia era comunque una ridistribuzione: una scelta che il progetto a monte fa in proprio e
si assume, e che tu non hai motivo di ereditare. Ora quel file non esiste piu. La lista la
scarica il browser di chi usa l app, direttamente dal server di chi la pubblica.

**Sui collegamenti.** La schermata sorgenti rimanda a progetti indipendenti e mostra sia la
pagina del progetto sia l indirizzo della lista. Un punto di attenzione onesto: la Corte di
giustizia europea, nel caso GS Media del 2016, ha stabilito che collegare a contenuti non
autorizzati puo essere rilevante quando chi collega lo fa a scopo di lucro o sapendo che il
contenuto e illecito. Tre ragioni per cui qui la posizione e comoda: il sito e privato e
senza scopo di lucro, i progetti elencati dichiarano entrambi di raccogliere solo flussi resi
pubblici dai titolari dei diritti, e il testo in fondo alla schermata dice chiaramente che
CATODO non verifica ne garantisce quel che c e dall altra parte.

**Cosa resta in capo a te.** Caricare solo liste che hai diritto di guardare. In pratica:
canali diffusi gratuitamente dalle emittenti. Se una lista pubblica contiene flussi che
arrivano da pannelli di rivendita invece che dal broadcaster, non e free-to-air: toglila o
non usare quella fonte. `check-playlist.mjs` ti aiuta a vederli.

**Sul contesto.** Tu risiedi in Italia e lavori in Svizzera, quindi valgono le regole italiane
per l uso e quelle del paese di hosting per il sito. In Italia AGCOM ha poteri molto incisivi
sui servizi che diffondono contenuti, ma quelli riguardano chi distribuisce: una pagina privata
protetta da password, per uso personale, senza contenuti propri, e un altro pianeta. Il fatto
che sia dietro autenticazione e con `noindex` non e solo igiene, e parte della posizione.

Infine: il browser della Tesla riproduce video solo a veicolo fermo, che e esattamente il modo
in cui questa cosa va usata.

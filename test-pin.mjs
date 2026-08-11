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

const HTML_PATH = new URL("./app.html", import.meta.url);
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

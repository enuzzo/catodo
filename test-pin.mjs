/**
 * CATODO: PIN gate test
 *
 * Loads app.html in jsdom and verifies the cases that caused the original
 * bug (unquoted octal number, trailing space from copy and paste),
 * plus the gate's basic behavior. Prints PASS/FAIL for each case and
 * exits with a nonzero code if something fails.
 *
 *   node test-pin.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("./app.html", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadHtml(){
  const raw = await readFile(HTML_PATH, "utf8");
  return raw.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/hls\.js[\s\S]*?<\/script>\s*/, "");
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
    if (!btn) throw new Error("button not found for digit " + ch);
    btn.click();
  }
}

const results = [];
function check(name, cond){
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
}

// Case 1: correct PIN (1984) unlocks the gate
{
  const dom = await openGate(await loadHtml());
  check("CFG.pin is set to 1984", dom.window.eval("CFG.pin") === "1984");
  check("the generated dots are 4, like the PIN", dom.window.document.querySelectorAll("#dots i").length === 4);
  await skipIntro(dom);
  pressDigits(dom, "1984");
  await sleep(250);
  check("correct PIN (1984) unlocks the gate", dom.window.document.getElementById("gate").classList.contains("hide"));
}

// Case 2: wrong PIN is rejected
{
  const dom = await openGate(await loadHtml());
  await skipIntro(dom);
  pressDigits(dom, "0000");
  await sleep(250);
  const doc = dom.window.document;
  check("wrong PIN does not unlock the gate", !doc.getElementById("gate").classList.contains("hide"));
  check("the dots signal the error", doc.getElementById("dots").classList.contains("bad"));
}

// Case 3: a trailing space in the configured PIN must not block access
{
  const html = overridePin(await loadHtml(), '"1984 "');
  const dom = await openGate(html);
  check("CFG.pin with a trailing space stays 1984 after trim", dom.window.eval("CFG.pin.trim()") === "1984");
  await skipIntro(dom);
  pressDigits(dom, "1984");
  await sleep(250);
  check("PIN typed without a space still unlocks the gate", dom.window.document.getElementById("gate").classList.contains("hide"));
}

// Case 4: the number of dots follows the PIN's actual length
{
  const html = overridePin(await loadHtml(), '"12"');
  const dom = await openGate(html);
  check("the dots follow a 2 digit PIN", dom.window.document.querySelectorAll("#dots i").length === 2);
}

// Case 5: an unquoted octal pin breaks parsing in strict mode
{
  const html = await loadHtml();
  const m = html.match(/<script>\n"use strict";[\s\S]*?<\/script>/);
  if (!m) throw new Error("inline script not found");

  const brokenSrc = overridePin(m[0], "0712").replace(/^<script>\n/, "").replace(/<\/script>$/, "");
  let threw = false;
  try { new Function(brokenSrc); } catch (e) { threw = e instanceof SyntaxError; }
  check("pin: 0712 without quotes breaks parsing (SyntaxError)", threw);

  const fixedSrc = overridePin(m[0], '"1984"').replace(/^<script>\n/, "").replace(/<\/script>$/, "");
  let ok = true;
  try { new Function(fixedSrc); } catch { ok = false; }
  check('pin: "1984" in quotes does not break parsing', ok);
}

const failed = results.filter(r => !r.ok);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " cases passed");
if (failed.length) process.exit(1);

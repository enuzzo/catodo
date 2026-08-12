import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import worker from "../../worker.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function proxyRequest(target, headers = {}) {
  return new Request("https://proxy.example/?url=" + encodeURIComponent(target), {
    headers: { origin: "https://catodo.netmilk.dev", ...headers }
  });
}

test("rejects a redirect to a denied host before fetching it", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/admin" }
    });
  };

  const response = await worker.fetch(proxyRequest("https://stream.example/start"));

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Host not allowed");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://catodo.netmilk.dev");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, "manual");
});

test("rejects credentials in initial and redirected URLs", async (t) => {
  await t.test("initial URL", async () => {
    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return new Response();
    };

    const response = await worker.fetch(proxyRequest("https://user:secret@stream.example/live"));

    assert.equal(response.status, 400);
    assert.equal(await response.text(), "Credentials not allowed");
    assert.equal(fetched, false);
  });

  await t.test("redirect URL", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(null, {
        status: 307,
        headers: { location: "https://user:secret@cdn.example/live" }
      });
    };

    const response = await worker.fetch(proxyRequest("https://stream.example/live"));

    assert.equal(response.status, 400);
    assert.equal(await response.text(), "Credentials not allowed");
    assert.equal(calls, 1);
  });
});

test("rebuilds per-host headers, preserves Range, and rewrites from the final URL", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example/live/master.m3u8" }
      });
    }
    return new Response("#EXTM3U\nsegment.ts", {
      status: 200,
      headers: { "content-type": "application/octet-stream" }
    });
  };

  const response = await worker.fetch(proxyRequest("https://stream.example/start.bin", {
    range: "bytes=100-200"
  }));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/vnd.apple.mpegurl; charset=utf-8");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.get("referer"), "https://stream.example/");
  assert.equal(calls[1].options.headers.get("referer"), "https://cdn.example/");
  assert.equal(calls[0].options.headers.get("range"), "bytes=100-200");
  assert.equal(calls[1].options.headers.get("range"), "bytes=100-200");
  assert.equal(
    body,
    "#EXTM3U\nhttps://proxy.example/?url=" +
      encodeURIComponent("https://cdn.example/live/segment.ts")
  );
});

test("stops after five followed redirects", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(null, {
      status: 301,
      headers: { location: `/hop-${calls}` }
    });
  };

  const response = await worker.fetch(proxyRequest("https://stream.example/start"));

  assert.equal(response.status, 502);
  assert.equal(await response.text(), "Too many redirects");
  assert.equal(calls, 6);
});

test("rejects a redirect to a non-http scheme", async () => {
  globalThis.fetch = async () => new Response(null, {
    status: 308,
    headers: { location: "file:///etc/passwd" }
  });

  const response = await worker.fetch(proxyRequest("https://stream.example/start"));

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Only http and https");
});

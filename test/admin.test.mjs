import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8791;
const BASE = "http://127.0.0.1:" + PORT;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function startServer(dataDir) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      DATA_DIR: dataDir,
      ADMIN_DEV_LOGIN: "1"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 8000);
    child.stdout.on("data", (buf) => {
      if (String(buf).includes("kuulab")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", (buf) => process.stderr.write(buf));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("server exited " + code));
    });
  });
}

function client() {
  let cookie = "";
  return async function request(pathname, opts) {
    opts = opts || {};
    const headers = { Origin: BASE, "Content-Type": "application/json" };
    if (opts.origin === null) delete headers.Origin;
    else if (opts.origin) headers.Origin = opts.origin;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + pathname, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const raw = res.headers.get("set-cookie") || "";
    const match = /merkuur_admin=([^;]*)/.exec(raw);
    if (match) cookie = match[1] ? "merkuur_admin=" + match[1] : "";
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (err) { json = null; }
    return { status: res.status, json: json, text: text };
  };
}

test("admin auth and published content", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-"));
  const child = await startServer(dataDir);
  const call = client();
  try {
    const home = await call("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /Haldus/);
    assert.match(home.text, /\/api\/content/);
    assert.match(home.text, /frantsiisipartnereid/);
    assert.match(home.text, /Franchise partners worldwide/);
    assert.match(home.text, /Aasta ringijuht 2018\/2019 Võsu kool/);
    assert.match(home.text, /Ajujahi 10\. hooaeg/);

    const admin = await call("/admin");
    assert.equal(admin.status, 200);
    assert.match(admin.text, /Logi sisse Gmailiga/);
    assert.match(admin.text, /googleClientId/);

    const hidden = await call("/data/admin.config.json");
    assert.equal(hidden.status, 404);
    const escape = await call("/uploads/../server.js");
    assert.equal(escape.status, 404);

    const open = await call("/api/content");
    assert.deepEqual(open.json.testimonials, []);

    const denied = await call("/api/content/testimonials", { method: "POST", body: { quote: "Tere", name: "Mari" } });
    assert.equal(denied.status, 401);

    const unconfigured = await call("/api/auth/google", { method: "POST", body: { credential: "aaa.bbb.ccc" } });
    assert.equal(unconfigured.status, 503);
    fs.writeFileSync(path.join(dataDir, "admin.config.json"), JSON.stringify({
      googleClientId: "test-client.apps.googleusercontent.com",
      allowedEmails: ["info@merkuur.eu"],
      allowFirstGoogleLogin: true
    }));
    const forged = await call("/api/auth/google", { method: "POST", body: { credential: "aaa.bbb.ccc" } });
    assert.equal(forged.status, 401);

    const cross = await call("/api/auth/dev", { method: "POST", origin: "https://evil.example", body: { email: "info@merkuur.eu" } });
    assert.equal(cross.status, 403);

    const first = await call("/api/auth/dev", { method: "POST", body: { email: "owner@gmail.com" } });
    assert.equal(first.status, 200);
    assert.equal(first.json.email, "owner@gmail.com");

    const outsider = client();
    const blocked = await outsider("/api/auth/dev", { method: "POST", body: { email: "other@gmail.com" } });
    assert.equal(blocked.status, 403);

    const badLink = await call("/api/content/news", { method: "POST", body: { title: "X", url: "javascript:alert(1)" } });
    assert.equal(badLink.status, 400);

    const quote = await call("/api/content/testimonials", {
      method: "POST",
      body: { quote: "<script>alert(1)</script> Väga hea töötuba", name: "Mari Tamm", role: "õpetaja", org: "Näidiskool" }
    });
    assert.equal(quote.status, 201);
    assert.equal(quote.json.quote.includes("<script>"), true);

    const uploaded = await call("/api/upload", { method: "POST", body: { dataUrl: PNG } });
    assert.equal(uploaded.status, 200);
    assert.match(uploaded.json.url, /^\/uploads\/[a-f0-9]+\.png$/);
    const file = await call(uploaded.json.url);
    assert.equal(file.status, 200);

    const news = await call("/api/content/news", {
      method: "POST",
      body: { title: "Uus töötuba", excerpt: "Tule kohale", url: "https://www.merkuur.eu/blog", image: uploaded.json.url }
    });
    assert.equal(news.status, 201);

    const photo = await call("/api/content/gallery", { method: "POST", body: { caption: "Töökojas", image: uploaded.json.url } });
    assert.equal(photo.status, 201);

    const address = await call("/api/address", { method: "PUT", body: { address: "Näidistänav 1, Rakvere" } });
    assert.equal(address.status, 200);

    const published = await call("/api/content");
    assert.equal(published.json.testimonials.length, 1);
    assert.equal(published.json.news[0].title, "Uus töötuba");
    assert.equal(published.json.gallery[0].caption, "Töökojas");
    assert.equal(published.json.address, "Näidistänav 1, Rakvere");

    const removed = await call("/api/content/testimonials/" + quote.json.id, { method: "DELETE" });
    assert.equal(removed.status, 200);
    const after = await call("/api/content");
    assert.equal(after.json.testimonials.length, 0);

    const bye = await call("/api/auth/logout", { method: "POST", body: {} });
    assert.equal(bye.status, 200);
    const again = await call("/api/content/news", { method: "POST", body: { title: "Ei tohi" } });
    assert.equal(again.status, 401);
  } finally {
    child.kill("SIGTERM");
  }
});

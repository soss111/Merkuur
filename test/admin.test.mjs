import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 8791;
const BASE = "http://127.0.0.1:" + PORT;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function startServer(dataDir, opts) {
  opts = opts || {};
  const port = opts.port || PORT;
  const env = Object.assign({}, process.env, {
    PORT: String(port),
    DATA_DIR: dataDir,
    ADMIN_DEV_LOGIN: "1",
    DATABASE_URL: ""
  });
  delete env.LOGIN_API_URL;
  if (opts.loginApi) env.LOGIN_API_URL = opts.loginApi;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: env,
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

function client(base) {
  base = base || BASE;
  let cookie = "";
  return async function request(pathname, opts) {
    opts = opts || {};
    const headers = { Origin: base, "Content-Type": "application/json" };
    if (opts.origin === null) delete headers.Origin;
    else if (opts.origin) headers.Origin = opts.origin;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + pathname, {
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
    assert.match(home.text, /src="files\/merkuur-logo\.png"/);
    assert.match(home.text, /href="admin"/);
    assert.doesNotMatch(home.text, /(?:href|src)="\/files\//);
    assert.doesNotMatch(home.text, /M28 68V34/);
    assert.match(home.text, /\/api\/content/);
    assert.match(home.text, /id="qform"/);
    assert.match(home.text, /Jäta tagasiside/);
    assert.doesNotMatch(home.text, /Lisa siia kliendi tagasiside tekst/);
    assert.match(home.text, /frantsiisipartnereid/);
    assert.match(home.text, /Franchise partners worldwide/);
    assert.match(home.text, /Aasta ringijuht 2018\/2019 Võsu kool/);
    assert.match(home.text, /Ajujahi 10\. hooaeg/);
    assert.equal((home.text.match(/class="mile-photo/g) || []).length, 11);
    assert.match(home.text, /Vaata rohkem/);
    assert.match(home.text, /id="tunnustused"/);
    assert.doesNotMatch(home.text, /class="honors"/);
    assert.match(home.text, /name="tel"/);
    assert.match(home.text, /alt="Liis Proos"/);
    assert.match(home.text, /tel:\+37253039287/);
    assert.doesNotMatch(home.text, /Lauri Soosaar/);
    assert.doesNotMatch(home.text, /5185404/);
    assert.match(home.text, /Palun täida nimi, telefon, e-post ja nõusolek/);
    assert.match(home.text, /Töö, mis on jätnud jälje/);
    assert.match(home.text, /data-stat="workshops"/);
    assert.match(home.text, /data-stat="asOf"/);
    assert.match(home.text, /data-stat="solutions"/);
    assert.doesNotMatch(home.text, /Meie töö märkamine/);
    assert.equal((home.text.match(/id="projektid"/g) || []).length, 1);
    assert.match(home.text, /xEdu/);
    assert.match(home.text, /831 osalejat/);
    assert.match(home.text, /354 noort/);
    assert.match(home.text, /Eesti Masinatööstuse Liidu/);
    assert.match(home.text, /Eesti Teadushuvihariduse Liidu/);
    assert.match(home.text, /https:\/\/emliit\.ee\/et\/liige\/merkuur-ou\//);
    assert.match(home.text, /https:\/\/teadushuvi\.ee\/liikmed\//);
    assert.doesNotMatch(home.text, /https:\/\/www\.merkuur\.eu\/tootoad/);
    assert.match(home.text, /href="\/tootoad"/);
    assert.match(home.text, /href="\/post\/ida-viru-projektis-osales-kokku-354-osalejat"/);
    assert.match(home.text, /Teemad, mida saab kokku panna/);
    assert.match(home.text, /data-topic="Pneumaatika"/);
    assert.match(home.text, /data-topic="Noorteinfo"/);
    assert.doesNotMatch(home.text, /kalender-1/);
    const oldCalendar = await fetch(BASE + "/kalender-1", { redirect: "manual" });
    assert.equal(oldCalendar.status, 302);
    assert.equal(oldCalendar.headers.get("location"), "/#teemad");

    const team = await call("/meeskond");
    assert.equal(team.status, 200);
    assert.ok(team.text.indexOf("Liis Proos") < team.text.indexOf("Lauri Soosaar"));
    assert.match(team.text, /Kaasasutaja</);
    assert.doesNotMatch(team.text, /5185404/);
    const workshop = await call("/tootoad");
    assert.equal(workshop.status, 200);
    assert.match(workshop.text, /käed-külge/);
    assert.match(workshop.text, /\/files\/merkuur-logo\.png/);
    assert.doesNotMatch(workshop.text, /M28 68V34/);
    const post = await call("/post/" + encodeURIComponent("ida-viru-projektis-osales-kokku-354-osalejat"));
    assert.equal(post.status, 200);
    assert.match(post.text, /354le noorele|354/);
    assert.match(post.text, /\/files\/merkuur-logo\.png/);
    const textbook = await call("/" + encodeURIComponent("õpik-arvjuhitavad-seadmed-cnc"));
    assert.equal(textbook.status, 200);
    assert.match(textbook.text, /e-koolikott\.ee/);
    const hiddenPage = await call("/tootoad/../../server.js");
    assert.equal(hiddenPage.status, 404);
    const css = await call("/site.css");
    assert.equal(css.status, 200);
    assert.match(css.text, /\.logo img\{[^}]*min-width:52px/);
    assert.match(team.text, /class="foot-brand"/);
    const icon = await call("/favicon.ico");
    assert.equal(icon.status, 200);
    const logo = await call("/files/merkuur-logo.png");
    assert.equal(logo.status, 200);

    const admin = await call("/admin");
    assert.equal(admin.status, 200);
    assert.match(admin.text, /Logi sisse Gmailiga/);
    assert.match(admin.text, /Saada kood/);
    assert.match(admin.text, /\/api\/auth\/code/);
    assert.match(admin.text, /src="files\/merkuur-logo\.png"/);
    assert.match(admin.text, /GitHubi eelvaade ei võta sisselogimist vastu/);
    assert.match(admin.text, /id="form-stats"/);
    assert.match(admin.text, /\/api\/stats/);

    const hidden = await call("/data/admin.config.json");
    assert.equal(hidden.status, 404);
    const escape = await call("/uploads/../server.js");
    assert.equal(escape.status, 404);

    const open = await call("/api/content");
    assert.deepEqual(open.json.testimonials, []);
    assert.deepEqual(open.json.stats, {
      since: "2016",
      workshops: "3500+",
      youth: "30 000",
      mobiles: "4",
      solutions: "100+",
      asOf: "detsember 2023"
    });
    const statsDenied = await call("/api/stats", { method: "PUT", body: { since: "2015", workshops: "1", youth: "1", mobiles: "1", solutions: "1", asOf: "nüüd" } });
    assert.equal(statsDenied.status, 401);

    const denied = await call("/api/content/testimonials", { method: "POST", body: { quote: "Tere", name: "Mari" } });
    assert.equal(denied.status, 401);
    const noConsent = await call("/api/feedback", { method: "POST", body: { quote: "Tere", name: "Mari" } });
    assert.equal(noConsent.status, 400);
    const guest = await call("/api/feedback", { method: "POST", body: { quote: "Väga hea töötuba", name: "Kati Kask", role: "õpetaja", org: "Neeme Kool", ok: true } });
    assert.equal(guest.status, 201);
    assert.equal(guest.json.testimonial.name, "Kati Kask");
    const honey = await call("/api/feedback", { method: "POST", body: { quote: "Rämps", name: "Bot", ok: true, website: "http://spam.test" } });
    assert.equal(honey.status, 200);
    assert.equal(honey.json.testimonial, undefined);
    const listed = await call("/api/content");
    assert.equal(listed.json.testimonials.length, 1);
    assert.equal(listed.json.testimonials[0].quote, "Väga hea töötuba");
    const foreign = await call("/api/feedback", { method: "POST", origin: "https://evil.example", body: { quote: "Tere", name: "Mari", ok: true } });
    assert.equal(foreign.status, 403);

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
    fs.unlinkSync(path.join(dataDir, "uploads", path.basename(uploaded.json.url)));
    const fromDb = await fetch(BASE + uploaded.json.url);
    const bytes = Buffer.from(await fromDb.arrayBuffer());
    assert.equal(fromDb.status, 200);
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);

    const news = await call("/api/content/news", {
      method: "POST",
      body: { title: "Uus töötuba", excerpt: "Tule kohale", url: "https://www.merkuur.eu/blog", image: uploaded.json.url }
    });
    assert.equal(news.status, 201);

    const photo = await call("/api/content/gallery", { method: "POST", body: { caption: "Töökojas", image: uploaded.json.url } });
    assert.equal(photo.status, 201);

    const address = await call("/api/address", { method: "PUT", body: { address: "Näidistänav 1, Rakvere" } });
    assert.equal(address.status, 200);
    const emptyStats = await call("/api/stats", {
      method: "PUT",
      body: { since: "2016", workshops: " ", youth: "1", mobiles: "1", solutions: "1", asOf: "nüüd" }
    });
    assert.equal(emptyStats.status, 400);
    const savedStats = await call("/api/stats", {
      method: "PUT",
      body: { since: "2016", workshops: "3600+", youth: "31 000", mobiles: "5", solutions: "110+", asOf: "oktoober 2026" }
    });
    assert.equal(savedStats.status, 200);
    assert.equal(savedStats.json.stats.workshops, "3600+");

    const published = await call("/api/content");
    assert.equal(published.json.testimonials.length, 2);
    assert.equal(published.json.news[0].title, "Uus töötuba");
    assert.equal(published.json.gallery[0].caption, "Töökojas");
    assert.equal(published.json.address, "Näidistänav 1, Rakvere");
    assert.equal(published.json.stats.workshops, "3600+");
    assert.equal(published.json.stats.youth, "31 000");
    assert.equal(published.json.stats.mobiles, "5");
    assert.equal(published.json.stats.solutions, "110+");
    assert.equal(published.json.stats.asOf, "oktoober 2026");
    assert.ok(fs.existsSync(path.join(dataDir, "content.sqlite")));
    const dbFile = await call("/data/content.sqlite");
    assert.equal(dbFile.status, 404);

    const service = await call("/api/content/services", {
      method: "POST",
      body: { title: "Koolitund ratastel", summary: "Tuleme kohale", href: "/tootoad", image: uploaded.json.url }
    });
    assert.equal(service.status, 201);
    const badService = await call("/api/content/services", { method: "POST", body: { title: "X", href: "javascript:alert(1)" } });
    assert.equal(badService.status, 400);

    const story = await call("/api/content/news", {
      method: "POST",
      body: { title: "Andmebaasi postitus", excerpt: "Lühike", body: "Esimene lõik\n<script>alert(1)</script>" }
    });
    assert.equal(story.status, 201);
    assert.equal(story.json.slug, "andmebaasi-postitus");
    const storyPage = await call("/post/andmebaasi-postitus");
    assert.equal(storyPage.status, 200);
    assert.match(storyPage.text, /Andmebaasi postitus/);
    assert.match(storyPage.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(storyPage.text, /<script>alert\(1\)<\/script>/);

    const stored = await call("/api/content");
    assert.equal(stored.json.services[0].title, "Koolitund ratastel");
    assert.equal(stored.json.services[0].href, "/tootoad");

    const removed = await call("/api/content/testimonials/" + quote.json.id, { method: "DELETE" });
    assert.equal(removed.status, 200);
    const after = await call("/api/content");
    assert.equal(after.json.testimonials.length, 1);
    assert.equal(after.json.testimonials[0].name, "Kati Kask");

    const bye = await call("/api/auth/logout", { method: "POST", body: {} });
    assert.equal(bye.status, 200);
    const again = await call("/api/content/news", { method: "POST", body: { title: "Ei tohi" } });
    assert.equal(again.status, 401);
  } finally {
    child.kill("SIGTERM");
  }
});

test("gmail code login uses the metalhub login service", async () => {
  const hits = [];
  const login = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const body = JSON.parse(raw);
      hits.push(body);
      res.setHeader("Content-Type", "application/json");
      if (body.action === "request_login_code") {
        res.end(JSON.stringify({ ok: true, email: body.email, message: "Login code sent. Check your email." }));
        return;
      }
      if (body.action === "verify_login_code" && body.code === "123456") {
        res.end(JSON.stringify({ ok: true, sessionToken: "session-token", loginId: body.email, expiresAt: new Date(Date.now() + 3600000).toISOString() }));
        return;
      }
      res.end(JSON.stringify({ ok: false, error: "Vale kood." }));
    });
  });
  await new Promise((resolve) => login.listen(0, "127.0.0.1", resolve));
  const loginApi = "http://127.0.0.1:" + login.address().port + "/api/exec";
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-login-"));
  const port = 8792;
  const base = "http://127.0.0.1:" + port;
  const child = await startServer(dataDir, { port: port, loginApi: loginApi });
  const call = client(base);
  try {
    const stranger = await call("/api/auth/code", { method: "POST", body: { email: "other@gmail.com" } });
    assert.equal(stranger.status, 403);
    assert.equal(hits.length, 0);

    const sent = await call("/api/auth/code", { method: "POST", body: { email: "LauriSoosaar@gmail.com" } });
    assert.equal(sent.status, 200);
    assert.match(sent.json.message, /Login code sent/);
    assert.equal(hits[0].action, "request_login_code");
    assert.equal(hits[0].email, "laurisoosaar@gmail.com");

    const bad = await call("/api/auth/verify", { method: "POST", body: { email: "laurisoosaar@gmail.com", code: "000000" } });
    assert.equal(bad.status, 401);

    const ok = await call("/api/auth/verify", { method: "POST", body: { email: "laurisoosaar@gmail.com", code: "123456" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.email, "laurisoosaar@gmail.com");
    const me = await call("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.json.email, "laurisoosaar@gmail.com");
  } finally {
    child.kill("SIGTERM");
    login.close();
  }
});

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const DATA = process.env.DATA_DIR || path.join(ROOT, "data");
const UPLOADS = path.join(DATA, "uploads");
const CONTENT_FILE = path.join(DATA, "content.json");
const CONFIG_FILE = path.join(DATA, "admin.config.json");
const SESSION_FILE = path.join(DATA, "sessions.json");
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
let database;
const MAX_JSON = 6 * 1024 * 1024;
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_ITEMS = 60;

const EMPTY_CONTENT = { address: "", testimonials: [], news: [], gallery: [] };
const DEFAULT_CONFIG = {
  googleClientId: "",
  allowedEmails: ["info@merkuur.eu"],
  allowFirstGoogleLogin: true
};

async function ensureData() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) writeJson(CONFIG_FILE, DEFAULT_CONFIG);
  if (!fs.existsSync(CONTENT_FILE)) writeJson(CONTENT_FILE, EMPTY_CONTENT);
  if (!fs.existsSync(SESSION_FILE)) writeJson(SESSION_FILE, {});
  database = await db.openDatabase(DATA);
  await database.importJsonOnce(CONTENT_FILE);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

function loadConfig() {
  const cfg = Object.assign({}, DEFAULT_CONFIG, readJson(CONFIG_FILE, {}));
  if (process.env.GOOGLE_CLIENT_ID) cfg.googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (process.env.GOOGLE_ALLOWED_EMAILS) {
    cfg.allowedEmails = process.env.GOOGLE_ALLOWED_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  cfg.allowedEmails = (cfg.allowedEmails || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  cfg.allowFirstGoogleLogin = cfg.allowFirstGoogleLogin !== false;
  return cfg;
}

function saveConfig(cfg) {
  const stored = {
    googleClientId: cfg.googleClientId || "",
    allowedEmails: cfg.allowedEmails,
    allowFirstGoogleLogin: cfg.allowFirstGoogleLogin !== false
  };
  writeJson(CONFIG_FILE, stored);
}

function loadContent() {
  return database.readContent();
}

function loadSessions() {
  const raw = readJson(SESSION_FILE, {});
  const now = Date.now();
  const live = {};
  Object.keys(raw).forEach((id) => {
    if (raw[id] && raw[id].exp > now) live[id] = raw[id];
  });
  return live;
}

function saveSessions(sessions) {
  writeJson(SESSION_FILE, sessions);
}

function clip(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function safeUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (v.startsWith("/uploads/")) {
    return /^\/uploads\/[a-zA-Z0-9._-]+$/.test(v) ? v : null;
  }
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch (err) {
    return null;
  }
}

function serviceHref(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^#[A-Za-z0-9-]+$/.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("..") && /^\/[\p{L}\p{N}._/-]*$/u.test(v)) return v;
  return safeUrl(v);
}

async function slugify(title, id) {
  const base = clip(title, 80).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  let slug = base || id;
  if (await database.slugTaken(slug)) slug = (base || "postitus") + "-" + id;
  return slug;
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionUser(req) {
  const id = parseCookies(req).merkuur_admin;
  if (!id) return null;
  const sessions = loadSessions();
  const row = sessions[id];
  if (!row || row.exp < Date.now()) return null;
  return { id: id, email: row.email };
}

function cookieSecure(req) {
  if (process.env.COOKIE_SECURE === "0") return false;
  const proto = req.headers["x-forwarded-proto"];
  if (proto) return String(proto).split(",")[0].trim() === "https";
  return false;
}

function setSessionCookie(req, res, value, maxAge) {
  const secure = cookieSecure(req) ? "; Secure" : "";
  res.setHeader("Set-Cookie", "merkuur_admin=" + value + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge + secure);
}

function isLocal(req) {
  const host = String(req.headers.host || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1";
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch (err) {
    return false;
  }
}

function send(res, status, body, type) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY"
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON) {
        reject(Object.assign(new Error("Liiga suur päring."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(Object.assign(new Error("Vigane JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const STAFF_EMAILS = ["laurisoosaar@gmail.com", "lauri.soosaar@gmail.com", "lauri.soosaar@venten.ee"];
const LOGIN_API = process.env.LOGIN_API_URL || "https://metalhub.ee/api/exec";
const authHits = new Map();
function rateLimit(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
  const now = Date.now();
  const recent = (authHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 30) return false;
  recent.push(now);
  authHits.set(ip, recent);
  return true;
}

async function verifyGoogle(idToken, clientId) {
  let res;
  try {
    res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "id_token=" + encodeURIComponent(idToken)
    });
  } catch (err) {
    throw Object.assign(new Error("Google'i sisselogimine ebaõnnestus."), { status: 401 });
  }
  if (!res.ok) throw Object.assign(new Error("Google'i sisselogimine ebaõnnestus."), { status: 401 });
  const info = await res.json();
  const iss = info.iss;
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw Object.assign(new Error("Google'i sisselogimine ebaõnnestus."), { status: 401 });
  }
  if (info.aud !== clientId) throw Object.assign(new Error("Google'i sisselogimine ebaõnnestus."), { status: 401 });
  if (String(info.email_verified) !== "true") throw Object.assign(new Error("Google'i e-post ei ole kinnitatud."), { status: 401 });
  if (Number(info.exp) * 1000 < Date.now()) throw Object.assign(new Error("Google'i sisselogimine ebaõnnestus."), { status: 401 });
  return String(info.email || "").toLowerCase();
}

function withStaff(cfg) {
  const emails = cfg.allowedEmails.slice();
  STAFF_EMAILS.forEach((email) => {
    if (emails.indexOf(email) === -1) emails.push(email);
  });
  return Object.assign({}, cfg, { allowedEmails: emails });
}

async function postLogin(action, fields) {
  let res;
  try {
    res = await fetch(LOGIN_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action: action }, fields)),
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    throw Object.assign(new Error("Sisselogimisteenus ei vasta."), { status: 502 });
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (err) {
    throw Object.assign(new Error("Sisselogimisteenus ei vastanud."), { status: 502 });
  }
  if (!data || data.ok !== true) {
    const message = String(data && data.error || "Sisselogimine ebaõnnestus.").slice(0, 200);
    throw Object.assign(new Error(message), { status: 401 });
  }
  return data;
}

function acceptEmail(email, opts) {
  opts = opts || {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("E-post ei sobi."), { status: 400 });
  }
  const cfg = withStaff(loadConfig());
  if (cfg.allowedEmails.indexOf(email) !== -1) return cfg;
  if (opts.enroll !== false && cfg.allowFirstGoogleLogin) {
    cfg.allowedEmails.push(email);
    cfg.allowFirstGoogleLogin = false;
    saveConfig(cfg);
    return cfg;
  }
  throw Object.assign(new Error("See Google'i konto ei ole haldurite nimekirjas."), { status: 403 });
}

function createSession(email) {
  const sessions = loadSessions();
  const id = crypto.randomBytes(24).toString("hex");
  sessions[id] = { email: email, exp: Date.now() + SESSION_MS };
  saveSessions(sessions);
  return id;
}

function requireUser(req, res) {
  const user = sessionUser(req);
  if (!user) {
    send(res, 401, { error: "Logi sisse." });
    return null;
  }
  return user;
}

async function imageFromDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) throw Object.assign(new Error("Luba ainult JPG, PNG, WEBP või GIF."), { status: 400 });
  const buf = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buf.length || buf.length > MAX_IMAGE) throw Object.assign(new Error("Pilt on liiga suur (max 4 MB)."), { status: 400 });
  const mime = match[1].toLowerCase();
  const sig = buf.subarray(0, 12).toString("hex");
  const ok =
    (mime === "image/jpeg" && sig.startsWith("ffd8ff")) ||
    (mime === "image/png" && sig.startsWith("89504e47")) ||
    (mime === "image/gif" && (sig.startsWith("47494638"))) ||
    (mime === "image/webp" && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP");
  if (!ok) throw Object.assign(new Error("Pildifail ei vasta tüübile."), { status: 400 });
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[mime];
  const name = crypto.randomBytes(16).toString("hex") + ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  await database.saveMedia(name, mime, buf);
  return "/uploads/" + name;
}

async function addItem(kind, body) {
  const tables = { testimonials: "feedback", news: "posts", gallery: "photos", services: "services" };
  if (!tables[kind]) throw Object.assign(new Error("Tundmatu liik."), { status: 400 });
  if (await database.countOf(tables[kind]) >= MAX_ITEMS) throw Object.assign(new Error("Kirjeid on juba maksimaalselt."), { status: 400 });
  const createdAt = new Date().toISOString();
  const id = newId();
  if (kind === "testimonials") {
    const quote = clip(body.quote, 800);
    const name = clip(body.name, 120);
    if (!quote || !name) throw Object.assign(new Error("Lisa tagasiside tekst ja nimi."), { status: 400 });
    const item = { id: id, quote: quote, name: name, role: clip(body.role, 120), org: clip(body.org, 160), createdAt: createdAt };
    await database.insertFeedback(item);
    return item;
  }
  if (kind === "news") {
    const title = clip(body.title, 180);
    if (!title) throw Object.assign(new Error("Lisa pealkiri."), { status: 400 });
    const url = safeUrl(body.url);
    const image = safeUrl(body.image);
    if (body.url && url == null) throw Object.assign(new Error("Lingi aadress ei sobi."), { status: 400 });
    if (body.image && image == null) throw Object.assign(new Error("Pildi aadress ei sobi."), { status: 400 });
    const item = {
      id: id,
      slug: await slugify(title, id),
      title: title,
      excerpt: clip(body.excerpt, 400),
      body: clip(body.body, 8000),
      url: url || "",
      image: image || "",
      createdAt: createdAt
    };
    await database.insertPost(item);
    return Object.assign({}, item, { url: item.url || (item.body ? "/post/" + item.slug : "") });
  }
  if (kind === "gallery") {
    const image = safeUrl(body.image);
    const caption = clip(body.caption, 120);
    if (!image || !caption) throw Object.assign(new Error("Lisa pilt ja allkiri."), { status: 400 });
    const item = { id: id, image: image, caption: caption, createdAt: createdAt };
    await database.insertPhoto(item);
    return item;
  }
  const title = clip(body.title, 160);
  if (!title) throw Object.assign(new Error("Lisa teenuse nimi."), { status: 400 });
  const href = serviceHref(body.href);
  const image = safeUrl(body.image);
  if (body.href && href == null) throw Object.assign(new Error("Lingi aadress ei sobi."), { status: 400 });
  if (body.image && image == null) throw Object.assign(new Error("Pildi aadress ei sobi."), { status: 400 });
  const item = { id: id, title: title, summary: clip(body.summary, 400), href: href || "", image: image || "", createdAt: createdAt };
  await database.insertService(item);
  return item;
}

function publicContent(content) {
  return {
    address: content.address,
    testimonials: content.testimonials,
    news: content.news,
    gallery: content.gallery,
    services: content.services
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function lookupPost(pathname) {
  let clean = pathname;
  if (clean.length > 1 && clean.endsWith("/")) clean = clean.slice(0, -1);
  if (!clean.startsWith("/post/")) return null;
  const slug = clean.slice("/post/".length);
  if (!slug || slug.includes("/") || !/^[\p{L}\p{N}-]+$/u.test(slug)) return null;
  const post = await database.postBySlug(slug);
  return post && post.body ? post : null;
}

function renderPost(post) {
  const paragraphs = String(post.body).split(/\n+/).map((line) => line.trim()).filter(Boolean)
    .map((line) => "<p>" + escapeHtml(line) + "</p>").join("\n");
  const image = post.image ? "<figure class=\"shots\"><img src=\"" + escapeHtml(post.image) + "\" alt=\"\"></figure>" : "";
  const title = escapeHtml(post.title);
  return "<!DOCTYPE html>\n<html lang=\"et\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>" + title + " · Merkuur</title>\n<link rel=\"canonical\" href=\"https://www.merkuur.eu/post/" + escapeHtml(post.slug) + "\">\n<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f6e5c'/%3E%3C/svg%3E\">\n<link rel=\"stylesheet\" href=\"/site.css\">\n</head>\n<body>\n<header><div class=\"wrap bar\"><a class=\"logo\" href=\"/\">Merkuur</a><button class=\"burger\" id=\"burger\" type=\"button\" aria-expanded=\"false\" aria-controls=\"mnav\" aria-label=\"Menüü\"><span></span><span></span><span></span></button><nav id=\"mnav\" aria-label=\"Põhimenüü\"><a href=\"/\">Pealeht</a><a href=\"/#teenused\">Teenused</a><a href=\"/blog\">Blogi</a><a class=\"btn\" href=\"/#kontakt\">Küsi pakkumist</a></nav></div></header>\n<main id=\"sisu\"><div class=\"wrap sheet wide\"><p class=\"kicker\">Blogi</p><h1>" + title + "</h1><div class=\"prose\">" + paragraphs + "</div>" + image + "<div class=\"cta\"><a class=\"btn\" href=\"/#kontakt\">Küsi pakkumist</a><a class=\"btn ghost\" href=\"/\">Tagasi avalehele</a></div></div></main>\n<footer><div class=\"wrap legal\">© Merkuur OÜ · reg 11544602</div></footer>\n<script src=\"/site.js\"></script>\n</body>\n</html>\n";
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf"
};

function resolvePublic(pathname) {
  const fixed = {
    "/": path.join(ROOT, "index.html"),
    "/index.html": path.join(ROOT, "index.html"),
    "/admin": path.join(ROOT, "admin.html"),
    "/admin/": path.join(ROOT, "admin.html"),
    "/admin.html": path.join(ROOT, "admin.html"),
    "/site.css": path.join(ROOT, "site.css"),
    "/site.js": path.join(ROOT, "site.js")
  };
  if (fixed[pathname]) return fixed[pathname];
  let clean = pathname;
  if (clean.length > 1 && clean.endsWith("/")) clean = clean.slice(0, -1);
  if (clean.startsWith("/files/")) {
    const name = clean.slice("/files/".length);
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
    const file = path.resolve(ROOT, "files", name);
    const root = path.resolve(ROOT, "files") + path.sep;
    if (!file.startsWith(root) || !fs.existsSync(file)) return null;
    return file;
  }
  const rel = clean.replace(/^\/+/, "");
  if (!rel || rel.split("/").some((part) => part === "." || part === "..")) return null;
  if (!/^[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*$/u.test(rel)) return null;
  const file = path.resolve(ROOT, "pages", rel + ".html");
  const root = path.resolve(ROOT, "pages") + path.sep;
  if (!file.startsWith(root) || !fs.existsSync(file)) return null;
  return file;
}

function serveFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400"
  });
  fs.createReadStream(file).pipe(res);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    try {
      if (req.method === "GET" && pathname === "/api/content") {
        return send(res, 200, publicContent(await loadContent()));
      }
      if (req.method === "GET" && pathname === "/api/auth/config") {
        const cfg = loadConfig();
        return send(res, 200, {
          configured: Boolean(cfg.googleClientId),
          clientId: cfg.googleClientId || "",
          allowFirstGoogleLogin: cfg.allowFirstGoogleLogin
        });
      }
      if (req.method === "GET" && pathname === "/api/auth/me") {
        const user = sessionUser(req);
        if (!user) return send(res, 401, { error: "Logi sisse." });
        const cfg = loadConfig();
        return send(res, 200, { email: user.email, allowedEmails: withStaff(cfg).allowedEmails });
      }
      if (req.method === "POST" && pathname === "/api/auth/dev") {
        if (process.env.ADMIN_DEV_LOGIN !== "1" || !isLocal(req)) return send(res, 404, { error: "Ei leitud." });
        if (!sameOrigin(req) && req.headers.origin) return send(res, 403, { error: "Vale päritolu." });
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        acceptEmail(email);
        const id = createSession(email);
        setSessionCookie(req, res, id, Math.floor(SESSION_MS / 1000));
        return send(res, 200, { email: email });
      }
      if (!sameOrigin(req) && req.method !== "GET") return send(res, 403, { error: "Vale päritolu." });

      if (req.method === "POST" && pathname === "/api/auth/code") {
        if (!rateLimit(req)) return send(res, 429, { error: "Liiga palju katseid. Proovi hiljem." });
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        acceptEmail(email, { enroll: false });
        const data = await postLogin("request_login_code", { email: email });
        return send(res, 200, { ok: true, email: email, message: String(data.message || "Kood saadetud. Vaata oma e-posti.") });
      }
      if (req.method === "POST" && pathname === "/api/auth/verify") {
        if (!rateLimit(req)) return send(res, 429, { error: "Liiga palju katseid. Proovi hiljem." });
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const code = String(body.code || "").replace(/\s+/g, "");
        if (!/^\d{4,8}$/.test(code)) return send(res, 400, { error: "Sisesta kood e-kirjast." });
        acceptEmail(email, { enroll: false });
        const data = await postLogin("verify_login_code", { email: email, code: code, displayName: "Merkuur" });
        const loginId = String(data.loginId || email).trim().toLowerCase();
        if (!data.sessionToken || loginId !== email) {
          return send(res, 401, { error: "Sisselogimine ebaõnnestus." });
        }
        const id = createSession(email);
        setSessionCookie(req, res, id, Math.floor(SESSION_MS / 1000));
        return send(res, 200, { email: email });
      }
      if (req.method === "POST" && pathname === "/api/auth/google") {
        if (!rateLimit(req)) return send(res, 429, { error: "Liiga palju katseid. Proovi hiljem." });
        const cfg = loadConfig();
        if (!cfg.googleClientId) return send(res, 503, { error: "Google'i kliendi ID puudub." });
        const body = await readBody(req);
        const credential = String(body.credential || "");
        if (credential.split(".").length !== 3 || credential.length > 5000) {
          return send(res, 401, { error: "Google'i sisselogimine ebaõnnestus." });
        }
        const email = await verifyGoogle(credential, cfg.googleClientId);
        acceptEmail(email);
        const id = createSession(email);
        setSessionCookie(req, res, id, Math.floor(SESSION_MS / 1000));
        return send(res, 200, { email: email });
      }
      if (req.method === "POST" && pathname === "/api/auth/logout") {
        const user = sessionUser(req);
        if (user) {
          const sessions = loadSessions();
          delete sessions[user.id];
          saveSessions(sessions);
        }
        setSessionCookie(req, res, "", 0);
        return send(res, 200, { ok: true });
      }

      const user = requireUser(req, res);
      if (!user) return;

      if (req.method === "POST" && pathname === "/api/upload") {
        const body = await readBody(req);
        const stored = await imageFromDataUrl(body.dataUrl);
        return send(res, 200, { url: stored });
      }
      if (req.method === "PUT" && pathname === "/api/address") {
        const body = await readBody(req);
        const address = clip(body.address, 240);
        await database.saveAddress(address);
        return send(res, 200, { address: address });
      }
      if (req.method === "POST" && pathname === "/api/admins") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: "E-post ei sobi." });
        const cfg = loadConfig();
        if (cfg.allowedEmails.indexOf(email) === -1) cfg.allowedEmails.push(email);
        cfg.allowFirstGoogleLogin = false;
        saveConfig(cfg);
        return send(res, 200, { allowedEmails: withStaff(cfg).allowedEmails });
      }
      if (req.method === "DELETE" && pathname === "/api/admins") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const cfg = loadConfig();
        if (cfg.allowedEmails.length < 2) return send(res, 400, { error: "Viimast haldurit ei saa eemaldada." });
        cfg.allowedEmails = cfg.allowedEmails.filter((item) => item !== email);
        cfg.allowFirstGoogleLogin = false;
        saveConfig(cfg);
        return send(res, 200, { allowedEmails: withStaff(cfg).allowedEmails });
      }

      const parts = pathname.split("/").filter(Boolean);
      if (parts[0] === "api" && parts[1] === "content" && parts[2] && ["testimonials", "news", "gallery", "services"].indexOf(parts[2]) !== -1) {
        if (req.method === "POST" && parts.length === 3) {
          const item = await addItem(parts[2], await readBody(req));
          return send(res, 201, item);
        }
        if (req.method === "DELETE" && parts.length === 4) {
          const id = parts[3];
          if (!/^[a-f0-9]{16}$/.test(id)) return send(res, 400, { error: "Vigane id." });
          await database.deleteItem(parts[2], id);
          return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: "Ei leitud." });
    } catch (err) {
      return send(res, err.status || 500, { error: err.status ? err.message : "Serveri viga." });
    }
  }

  if (pathname.startsWith("/uploads/")) {
    const name = pathname.slice("/uploads/".length);
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return send(res, 404, { error: "Ei leitud." });
    const file = path.join(UPLOADS, name);
    if (fs.existsSync(file)) return serveFile(res, file);
    const media = await database.readMedia(name);
    if (!media) return send(res, 404, { error: "Ei leitud." });
    res.writeHead(200, {
      "Content-Type": media.mime,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Cache-Control": "public, max-age=86400",
      "Content-Length": media.bytes.length
    });
    res.end(media.bytes);
    return;
  }

  const file = resolvePublic(pathname);
  if (file) return serveFile(res, file);
  if (req.method === "GET") {
    const post = await lookupPost(pathname);
    if (post) return send(res, 200, renderPost(post), "text/html; charset=utf-8");
  }
  send(res, 404, "Ei leitud.", "text/plain; charset=utf-8");
}

async function start() {
  await ensureData();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) send(res, 500, { error: "Serveri viga." });
      else res.end();
    });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log("Merkuur kuulab pordil " + PORT + " — avalik leht / ja haldus /admin — " + database.label);
  });
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { start, loadConfig, acceptEmail };

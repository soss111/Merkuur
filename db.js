"use strict";

const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const TABLES = [
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    quote TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    org TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    image TEXT NOT NULL,
    caption TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`
];

function isPostgres(url) {
  return /^postgres(ql)?:\/\//i.test(String(url || "").trim());
}

function loadEnv(file) {
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch (err) { return; }
  text.split(/\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq < 1) return;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    if (process.env[key]) return;
    let value = body.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL !== undefined) return String(process.env.DATABASE_URL).trim();
  const aliases = ["POSTGRES_URL", "POSTGRESQL_URL", "DATABASE_PRIVATE_URL"];
  for (const key of aliases) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  if (process.env.PGHOST || process.env.PGDATABASE) return "pg-env";
  return "";
}

function sqliteFile(dataDir, databaseUrl) {
  const url = String(databaseUrl || "").trim();
  if (!url) return path.join(dataDir, "content.sqlite");
  if (path.isAbsolute(url) && /\.(sqlite|sqlite3|db)$/i.test(url)) return url;
  if (url.startsWith("file:")) return fileURLToPath(url);
  const match = /^sqlite:(.*)$/i.exec(url);
  if (!match) {
    throw Object.assign(new Error("DATABASE_URL peab olema postgres://, sqlite: või file: aadress."), { status: 500 });
  }
  let spec = match[1];
  if (spec.startsWith("///")) spec = spec.slice(2);
  else if (spec.startsWith("//")) spec = spec.slice(2);
  if (!path.isAbsolute(spec)) spec = path.resolve(dataDir, spec);
  return spec;
}

function driverFor(databaseUrl, dataDir) {
  const url = String(databaseUrl || "").trim();
  if (isPostgres(url)) {
    let name = "database";
    try { name = new URL(url).pathname.replace(/^\//, "") || name; } catch (err) { name = "database"; }
    return { driver: "postgres", label: "postgres " + name };
  }
  const file = sqliteFile(dataDir || ".", url);
  return { driver: "sqlite", file: file, label: "sqlite " + file };
}

function mapFeedback(row) {
  return { id: row.id, quote: row.quote, name: row.name, role: row.role, org: row.org, createdAt: row.created_at };
}

function mapPost(row) {
  const url = row.url || (row.body ? "/post/" + row.slug : "");
  return { id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, body: row.body, url: url, image: row.image, createdAt: row.created_at };
}

function mapPhoto(row) {
  return { id: row.id, image: row.image, caption: row.caption, createdAt: row.created_at };
}

function mapService(row) {
  return { id: row.id, title: row.title, summary: row.summary, href: row.href, image: row.image, createdAt: row.created_at };
}

function mapStep(row) {
  return { id: row.id, title: row.title, detail: row.detail, tag: row.tag, createdAt: row.created_at };
}

function mapPerson(row) {
  return { id: row.id, name: row.name, role: row.role, phone: row.phone, email: row.email, image: row.image, createdAt: row.created_at };
}

function mapMilestone(row) {
  return { id: row.id, period: row.period, title: row.title, detail: row.detail, href: row.href, image: row.image, createdAt: row.created_at };
}

const DEFAULT_STATS = {
  since: "2016",
  workshops: "3500+",
  youth: "30 000",
  mobiles: "4",
  solutions: "100+",
  asOf: "detsember 2023"
};

function statsFrom(raw) {
  const stats = Object.assign({}, DEFAULT_STATS);
  if (!raw) return stats;
  Object.keys(DEFAULT_STATS).forEach((key) => {
    if (typeof raw[key] === "string" && raw[key].trim()) stats[key] = raw[key].trim();
  });
  return stats;
}

const SEED_SERVICES = [
  {
    id: "5eed5e4700000001",
    title: "Töötoad",
    summary: "Käed-külge töötoad puidu- ja metallitööst, elektroonikast, bioonikast ja inseneeriast noortele (7–18) ja täiskasvanutele – ka sünnipäevadele ja meeskonnaüritustele. Teemasid saab omavahel kokku panna.",
    href: "/tootoad",
    image: "https://static.wixstatic.com/media/a7f28e_49c2a64583b44ef894a64e2770e6c94b~mv2.jpg/v1/fill/w_980,h_655,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:01.000Z"
  },
  {
    id: "5eed5e4700000002",
    title: "Tehnoloogiatunnid",
    summary: "Mobiilsed huviringid, koolitused ja gümnaasiumi inseneeria valikkursused – seadmed otse klassiruumis.",
    href: "/huviringid",
    image: "https://static.wixstatic.com/media/a7f28e_d96711c8a73f4287a56272f4e6fe22a1~mv2.jpg/v1/fill/w_980,h_732,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:02.000Z"
  },
  {
    id: "5eed5e4700000003",
    title: "Õpilahenduste arendus",
    summary: "Digiõpik «Arvjuhitavad seadmed», tunnikavad ja õppematerjalid, mis aitavad tehnoloogiat koolitundi tuua.",
    href: "/õpik-arvjuhitavad-seadmed-cnc",
    image: "https://static.wixstatic.com/media/a7f28e_7df29537faf14ca3bf3bca541e40da4b~mv2_d_6000_4000_s_4_2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:03.000Z"
  },
  {
    id: "5eed5e4700000004",
    title: "Makerspace ja tehnoloogiaklass",
    summary: "Rajame koolidele ja noortekeskustele tehnoloogia õppeklassi – seadmed, sisu ja koolitus ühes paketis.",
    href: "/futureclassroomlab",
    image: "https://static.wixstatic.com/media/a7f28e_c34f073e4336408ca677769001eef86c~mv2_d_4943_3296_s_4_2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:04.000Z"
  },
  {
    id: "5eed5e4700000005",
    title: "Mobiilsed töökojad",
    summary: "Iseehitatud liikuv õppeklass: metalli- ja puidutöökoda ratastel. Tuleme kooliõuele, külla või üritusele – seadmed ja tööriistad kaasas.",
    href: "/mobileworkshops",
    image: "https://static.wixstatic.com/media/a7f28e_a8fffa03b3bd41cd9d7cf3f80f7251c6~mv2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:05.000Z"
  },
  {
    id: "5eed5e4700000006",
    title: "Karjääriteemad",
    summary: "Karjääriinfo ja -nõustamine (individuaalne ja grupinõustamine) ning karjääriteadlikkust tõstvad tegevused. Neid juhib Liis, kogenud karjäärinõustaja.",
    href: "/bettercareer",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:06.000Z"
  }
];

const SEED_POSTS = [
  {
    id: "5eed905700000001",
    slug: "tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde-1",
    title: "Tule töötuppa! Või muidu tuleb töötuba sinu juurde!",
    excerpt: "",
    body: "",
    url: "/post/tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde-1",
    image: "https://static.wixstatic.com/media/a7f28e_68073d44abf044bf913b61f880205682~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2025-01-20T12:00:00.000Z"
  },
  {
    id: "5eed905700000002",
    slug: "ida-viru-projektis-osales-kokku-354-osalejat",
    title: "Ida-Viru projektis osales kokku 354 osalejat",
    excerpt: "",
    body: "",
    url: "/post/ida-viru-projektis-osales-kokku-354-osalejat",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2024-12-01T12:00:00.000Z"
  },
  {
    id: "5eed905700000003",
    slug: "tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde",
    title: "Tule töötuppa! Või muidu tuleb töötuba sinu juurde!",
    excerpt: "",
    body: "",
    url: "/post/tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde",
    image: "https://static.wixstatic.com/media/a7f28e_9792dc3de2404bb69f8caebfb630e963~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2024-07-10T12:00:00.000Z"
  }
];

const SEED_STEPS = [
  {
    id: "5eed70ad00000001",
    title: "Tutvumine",
    detail: "Räägime eesmärkidest, sihtrühmast ja ajast. Soovi korral tellid seadmete demo.",
    tag: "Tasuta vestlus",
    createdAt: "2016-03-01T00:00:01.000Z"
  },
  {
    id: "5eed70ad00000002",
    title: "Töötuba",
    detail: "Mobiilne töötuba või tehnoloogiatund tuleb kohale ja õpilased proovivad ise.",
    tag: "Mobiilsed töökojad",
    createdAt: "2016-03-01T00:00:02.000Z"
  },
  {
    id: "5eed70ad00000003",
    title: "Huviring ja kursus",
    detail: "Regulaarne huviring või gümnaasiumi CNC valikkursus annab sügavamad oskused.",
    tag: "Tehnoloogiatunnid",
    createdAt: "2016-03-01T00:00:03.000Z"
  },
  {
    id: "5eed70ad00000004",
    title: "Oma klassiruum",
    detail: "Rajame makerspace'i või tehnoloogiaklassi: seadmed, sisu ja õpetajate koolitus.",
    tag: "Õppeklass",
    createdAt: "2016-03-01T00:00:04.000Z"
  },
  {
    id: "5eed70ad00000005",
    title: "Tugi ja areng",
    detail: "Õppematerjalid, digiõpik, makerset'id ja nõustamine hoiavad tegevuse käimas.",
    tag: "E-pood · koolitused",
    createdAt: "2016-03-01T00:00:05.000Z"
  }
];

const SEED_PEOPLE = [
  { id: "5eed0ea000000001", name: "Liis Proos", role: "Kaasasutaja ja noortele suunatud projektide eestvedaja", phone: "+372 53 039 287", email: "info@merkuur.eu", image: "https://static.wixstatic.com/media/a7f28e_c92416e68df240db83d64af5f4a45858~mv2_d_5379_3587_s_4_2.jpg/v1/crop/x_0,y_0,w_3575,h_3587/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:01.000Z" },
  { id: "5eed0ea000000002", name: "Mari Toom", role: "", phone: "", email: "", image: "https://static.wixstatic.com/media/a7f28e_38e6fc354cac42f094a7ba26aa664d3c~mv2.jpg/v1/crop/x_0,y_121,w_720,h_717/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:02.000Z" },
  { id: "5eed0ea000000003", name: "Taavi Källo", role: "Töötubade juhendaja ja Ida-Viru baasi tehniline arendaja", phone: "+372 55668339", email: "idaviru@merkuur.eu", image: "https://static.wixstatic.com/media/a7f28e_6b788ba01fc64407a5180f624cae3e42~mv2.jpg/v1/crop/x_545,y_0,w_910,h_920/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:03.000Z" },
  { id: "5eed0ea000000004", name: "Töötubade juhendaja ja arendaja", role: "", phone: "+372 56633944", email: "info@merkuur.eu", image: "", createdAt: "2016-02-01T00:00:04.000Z" },
  { id: "5eed0ea000000005", name: "Marek Soosaar", role: "Meister", phone: "+372 53 409 997", email: "mareksoosaar@hot.ee", image: "https://static.wixstatic.com/media/a7f28e_0cc97e5cdf384eb49fbe58dc79945bdb~mv2_d_3024_4032_s_4_2.jpg/v1/crop/x_0,y_489,w_3024,h_3054/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:05.000Z" },
  { id: "5eed0ea000000006", name: "Vaili Viirlaid", role: "Töötubade juhendaja ja Ida-Viru projektijuht", phone: "+372 5039141", email: "idaviru@merkuur.eu", image: "https://static.wixstatic.com/media/a7f28e_9792dc3de2404bb69f8caebfb630e963~mv2.jpg/v1/crop/x_1023,y_84,w_218,h_222/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:06.000Z" },
  { id: "5eed0ea000000007", name: "Kuldar Mänd", role: "Töötubade juhendaja", phone: "+372 56651877", email: "idaviru@merkuur.eu", image: "https://static.wixstatic.com/media/a7f28e_d40fa06f352c42f99b7b1412a28ee1a7~mv2.jpg/v1/crop/x_0,y_96,w_204,h_206/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:07.000Z" },
  { id: "5eed0ea000000008", name: "Lauri Soosaar", role: "Kaasasutaja", phone: "", email: "", image: "https://static.wixstatic.com/media/a7f28e_f7e3f445307f430f9781c4695dd28d42~mv2_d_4000_6000_s_4_2.jpg/v1/fill/w_640,h_640,al_c,q_80/a.jpg", createdAt: "2016-02-01T00:00:08.000Z" }
];

const SEED_PHOTOS = [
  {
    id: "5eedf07000000001",
    image: "https://static.wixstatic.com/media/a7f28e_1804c8ea80de4870aaba580d4528a812~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Neeme küla",
    createdAt: "2024-04-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000002",
    image: "https://static.wixstatic.com/media/a7f28e_a2de679276f844059b3e5e041ec508c1~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Metalli töötuba, Tartu",
    createdAt: "2024-03-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000003",
    image: "https://static.wixstatic.com/media/a7f28e_67ca9d735af24001a6ba630a22aa21d7~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Mart Müllerbeck",
    createdAt: "2024-02-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000004",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Ida-Viru projekt",
    createdAt: "2024-01-01T12:00:00.000Z"
  }
];

const COPY_TABLES = [
  { table: "feedback", cols: ["id", "quote", "name", "role", "org", "created_at"] },
  { table: "posts", cols: ["id", "slug", "title", "excerpt", "body", "url", "image", "created_at"] },
  { table: "photos", cols: ["id", "image", "caption", "created_at"] },
  { table: "services", cols: ["id", "title", "summary", "href", "image", "created_at"] },
  { table: "steps", cols: ["id", "title", "detail", "tag", "created_at"] },
  { table: "milestones", cols: ["id", "period", "title", "detail", "href", "image", "created_at"] }
];

async function copyMissing(source, target) {
  let copied = 0;
  for (const spec of COPY_TABLES) {
    const rows = await source.all("SELECT " + spec.cols.join(", ") + " FROM " + spec.table);
    for (const row of rows) {
      const values = spec.cols.map((col) => row[col] == null ? "" : row[col]);
      const changes = await target.run(
        "INSERT INTO " + spec.table + " (" + spec.cols.join(", ") + ") VALUES (" + spec.cols.map(() => "?").join(", ") + ") ON CONFLICT(id) DO NOTHING",
        values
      );
      copied += Number(changes) || 0;
    }
  }
  const settings = await source.all("SELECT key, value FROM settings");
  for (const row of settings) {
    if (!row || !row.key) continue;
    if (await target.setting(row.key, "")) continue;
    await target.setSetting(row.key, row.value == null ? "" : String(row.value));
    copied += 1;
  }
  const media = await source.all("SELECT name, mime, bytes FROM media");
  for (const row of media) {
    if (!row || !row.name || row.bytes == null) continue;
    const bytes = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
    const changes = await target.run(
      "INSERT INTO media (name, mime, bytes) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING",
      [row.name, row.mime || "application/octet-stream", bytes]
    );
    copied += Number(changes) || 0;
  }
  return copied;
}

function api(driver) {
  return {
    label: driver.label,
    driver: driver.kind || "sqlite",
    importedRows: 0,
    async pullMissingFrom(file) {
      if (!file || !fs.existsSync(file)) return 0;
      return copyMissing(openSqlite(file), driver);
    },
    async importJsonOnce(contentFile) {
      if (await driver.setting("imported_json", "") === "1") return;
      let raw = { address: "", testimonials: [], news: [], gallery: [] };
      try { raw = Object.assign(raw, JSON.parse(fs.readFileSync(contentFile, "utf8"))); } catch (err) { raw = { address: "", testimonials: [], news: [], gallery: [] }; }
      for (const item of raw.testimonials || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO feedback (id, quote, name, role, org, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.quote || "", item.name || "", item.role || "", item.org || "", item.createdAt || new Date().toISOString()]
        );
      }
      for (const item of raw.news || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO posts (id, slug, title, excerpt, body, url, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.slug || item.id, item.title || "", item.excerpt || "", item.body || "", item.url || "", item.image || "", item.createdAt || new Date().toISOString()]
        );
      }
      for (const item of raw.gallery || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO photos (id, image, caption, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.image || "", item.caption || "", item.createdAt || new Date().toISOString()]
        );
      }
      if (typeof raw.address === "string" && raw.address && !(await driver.setting("address", ""))) await driver.setSetting("address", raw.address);
      await driver.setSetting("imported_json", "1");
    },
    async seedCatalogOnce() {
      if ((await this.countOf("services")) === 0) {
        for (const item of SEED_SERVICES) await this.insertService(item);
      }
      if ((await this.countOf("posts")) === 0) {
        for (const item of SEED_POSTS) await this.insertPost(item);
      }
      if ((await this.countOf("photos")) === 0) {
        for (const item of SEED_PHOTOS) await this.insertPhoto(item);
      }
      if ((await this.countOf("steps")) === 0) {
        for (const item of SEED_STEPS) await this.insertStep(item);
      }
      if ((await this.countOf("people")) === 0) {
        for (const item of SEED_PEOPLE) await this.insertPerson(item);
      }
      if (!(await driver.setting("stats", ""))) await this.saveStats(DEFAULT_STATS);
    },
    async readContent() {
      let stored = null;
      try { stored = JSON.parse(await driver.setting("stats", "")); } catch (err) { stored = null; }
      return {
        address: await driver.setting("address", ""),
        stats: statsFrom(stored),
        testimonials: (await driver.all("SELECT * FROM feedback ORDER BY created_at DESC")).map(mapFeedback),
        news: (await driver.all("SELECT * FROM posts ORDER BY created_at DESC")).map(mapPost),
        gallery: (await driver.all("SELECT * FROM photos ORDER BY created_at DESC")).map(mapPhoto),
        services: (await driver.all("SELECT * FROM services ORDER BY created_at ASC")).map(mapService),
        roadmap: (await driver.all("SELECT * FROM steps ORDER BY created_at ASC")).map(mapStep),
        people: (await driver.all("SELECT * FROM people ORDER BY created_at ASC")).map(mapPerson),
        milestones: (await driver.all("SELECT * FROM milestones ORDER BY created_at ASC")).map(mapMilestone),
        copy: await this.readCopy(),
        supportUrl: await driver.setting("support_url", "")
      };
    },
    async readCopy() {
      let stored = {};
      try { stored = JSON.parse(await driver.setting("copy", "")) || {}; } catch (err) { stored = {}; }
      const copy = {};
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return copy;
      Object.keys(stored).forEach((key) => {
        if (/^[a-z0-9:-]{1,80}$/.test(key) && typeof stored[key] === "string" && stored[key].trim()) copy[key] = stored[key].trim();
      });
      return copy;
    },
    async saveCopy(copy) {
      await driver.setSetting("copy", JSON.stringify(copy));
    },
    async countOf(table) {
      const allowed = { feedback: 1, posts: 1, photos: 1, services: 1, steps: 1, people: 1, milestones: 1 };
      if (!allowed[table]) throw new Error("Tundmatu tabel.");
      const row = await driver.get("SELECT COUNT(*) AS n FROM " + table);
      return Number(row.n);
    },
    async insertFeedback(item) {
      await driver.run(
        "INSERT INTO feedback (id, quote, name, role, org, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.quote, item.name, item.role, item.org, item.createdAt]
      );
    },
    async insertPost(item) {
      await driver.run(
        "INSERT INTO posts (id, slug, title, excerpt, body, url, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.slug, item.title, item.excerpt, item.body, item.url, item.image, item.createdAt]
      );
    },
    async insertPhoto(item) {
      await driver.run(
        "INSERT INTO photos (id, image, caption, created_at) VALUES (?, ?, ?, ?)",
        [item.id, item.image, item.caption, item.createdAt]
      );
    },
    async insertService(item) {
      await driver.run(
        "INSERT INTO services (id, title, summary, href, image, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.title, item.summary, item.href, item.image, item.createdAt]
      );
    },
    async insertStep(item) {
      await driver.run(
        "INSERT INTO steps (id, title, detail, tag, created_at) VALUES (?, ?, ?, ?, ?)",
        [item.id, item.title, item.detail, item.tag, item.createdAt]
      );
    },
    async insertPerson(item) {
      await driver.run(
        "INSERT INTO people (id, name, role, phone, email, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.role || "", item.phone || "", item.email || "", item.image || "", item.createdAt]
      );
    },
    async insertMilestone(item) {
      await driver.run(
        "INSERT INTO milestones (id, period, title, detail, href, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.period || "", item.title, item.detail || "", item.href || "", item.image || "", item.createdAt]
      );
    },
    async updateMilestone(item) {
      await driver.run(
        "UPDATE milestones SET period = ?, title = ?, detail = ?, href = ?, image = ? WHERE id = ?",
        [item.period || "", item.title, item.detail || "", item.href || "", item.image || "", item.id]
      );
    },
    async updatePerson(item) {
      await driver.run(
        "UPDATE people SET name = ?, role = ?, phone = ?, email = ?, image = ? WHERE id = ?",
        [item.name, item.role || "", item.phone || "", item.email || "", item.image || "", item.id]
      );
    },
    async findStep(id) {
      const row = await driver.get("SELECT * FROM steps WHERE id = ?", [id]);
      return row ? mapStep(row) : null;
    },
    async setCreatedAt(table, id, createdAt) {
      const allowed = { feedback: 1, posts: 1, photos: 1, services: 1, steps: 1, people: 1, milestones: 1 };
      if (!allowed[table]) throw new Error("Tundmatu tabel.");
      await driver.run("UPDATE " + table + " SET created_at = ? WHERE id = ?", [createdAt, id]);
    },
    async updateStep(item) {
      await driver.run(
        "UPDATE steps SET title = ?, detail = ?, tag = ? WHERE id = ?",
        [item.title, item.detail, item.tag, item.id]
      );
    },
    async setCreatedAt(table, id, createdAt) {
      const allowed = { feedback: 1, posts: 1, photos: 1, services: 1, steps: 1, people: 1, milestones: 1 };
      if (!allowed[table]) throw new Error("Tundmatu tabel.");
      await driver.run("UPDATE " + table + " SET created_at = ? WHERE id = ?", [createdAt, id]);
    },
    async findItem(kind, id) {
      const table = { testimonials: "feedback", news: "posts", gallery: "photos", services: "services", people: "people", milestones: "milestones" }[kind];
      const map = { testimonials: mapFeedback, news: mapPost, gallery: mapPhoto, services: mapService, people: mapPerson, milestones: mapMilestone }[kind];
      if (!table) return null;
      const row = await driver.get("SELECT * FROM " + table + " WHERE id = ?", [id]);
      return row ? map(row) : null;
    },
    async updateFeedback(item) {
      const changes = await driver.run(
        "UPDATE feedback SET quote = ?, name = ?, role = ?, org = ? WHERE id = ?",
        [item.quote, item.name, item.role, item.org, item.id]
      );
      return changes > 0;
    },
    async updatePost(item) {
      const changes = await driver.run(
        "UPDATE posts SET title = ?, excerpt = ?, body = ?, url = ?, image = ? WHERE id = ?",
        [item.title, item.excerpt, item.body, item.url, item.image, item.id]
      );
      return changes > 0;
    },
    async updatePhoto(item) {
      const changes = await driver.run(
        "UPDATE photos SET image = ?, caption = ? WHERE id = ?",
        [item.image, item.caption, item.id]
      );
      return changes > 0;
    },
    async updateService(item) {
      const changes = await driver.run(
        "UPDATE services SET title = ?, summary = ?, href = ?, image = ? WHERE id = ?",
        [item.title, item.summary, item.href, item.image, item.id]
      );
      return changes > 0;
    },
    async deleteItem(kind, id) {
      const table = { testimonials: "feedback", news: "posts", gallery: "photos", services: "services", roadmap: "steps", people: "people", milestones: "milestones" }[kind];
      if (!table) return false;
      const changes = await driver.run("DELETE FROM " + table + " WHERE id = ?", [id]);
      return changes > 0;
    },
    async saveAddress(address) {
      await driver.setSetting("address", address);
    },
    async saveSupportUrl(url) {
      await driver.setSetting("support_url", url);
    },
    async saveStats(stats) {
      await driver.setSetting("stats", JSON.stringify(statsFrom(stats)));
    },
    async adminConfig() {
      const raw = await driver.setting("admin_config", "");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch (err) {
        return null;
      }
    },
    async saveAdminConfig(cfg) {
      await driver.setSetting("admin_config", JSON.stringify(cfg));
    },
    async slugTaken(slug) {
      return Boolean(await driver.get("SELECT 1 AS ok FROM posts WHERE slug = ?", [slug]));
    },
    async postBySlug(slug) {
      const row = await driver.get("SELECT * FROM posts WHERE slug = ?", [slug]);
      return row ? mapPost(row) : null;
    },
    async importPosts(items) {
      for (const item of items || []) {
        if (!item || !item.slug || !item.title || !item.id) continue;
        const existing = await this.postBySlug(item.slug);
        if (!existing) {
          await this.insertPost(item);
          continue;
        }
        if (existing.body || !item.body) continue;
        await driver.run(
          "UPDATE posts SET body = ?, excerpt = CASE WHEN excerpt = '' THEN ? ELSE excerpt END, image = CASE WHEN image = '' THEN ? ELSE image END WHERE slug = ?",
          [item.body, item.excerpt || "", item.image || "", item.slug]
        );
      }
    },
    async saveMedia(name, mime, bytes) {
      await driver.run(
        "INSERT INTO media (name, mime, bytes) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes",
        [name, mime, bytes]
      );
    },
    async readMedia(name) {
      const row = await driver.get("SELECT mime, bytes FROM media WHERE name = ?", [name]);
      if (!row) return null;
      return { mime: row.mime, bytes: Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes) };
    }
  };
}

function openSqlite(file) {
  const { DatabaseSync } = require("node:sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  TABLES.forEach((sql) => db.exec(sql));
  db.exec("CREATE TABLE IF NOT EXISTS media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL)");
  return {
    kind: "sqlite",
    label: "sqlite " + file,
    all(sql, params) { return db.prepare(sql).all(...(params || [])); },
    get(sql, params) { return db.prepare(sql).get(...(params || [])) || null; },
    run(sql, params) { return db.prepare(sql).run(...(params || [])).changes; },
    setting(key, fallback) {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return row ? row.value : fallback;
    },
    setSetting(key, value) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    }
  };
}

function sqliteDriver(file) {
  return api(openSqlite(file));
}

async function postgresDriver(url) {
  const { Pool } = require("pg");
  const pool = url ? new Pool({ connectionString: url, max: 5 }) : new Pool({ max: 5 });
  const query = async (sql, params) => {
    let i = 0;
    const text = sql.replace(/\?/g, () => "$" + (++i));
    return pool.query(text, params || []);
  };
  for (const sql of TABLES) await query(sql);
  await query("CREATE TABLE IF NOT EXISTS media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BYTEA NOT NULL)");
  const info = url ? driverFor(url, ".") : { driver: "postgres", label: "postgres " + (process.env.PGDATABASE || "database") };
  return api({
    kind: "postgres",
    label: info.label,
    async all(sql, params) { return (await query(sql, params)).rows; },
    async get(sql, params) { return (await query(sql, params)).rows[0] || null; },
    async run(sql, params) { return (await query(sql, params)).rowCount; },
    async setting(key, fallback) {
      const row = (await query("SELECT value FROM settings WHERE key = ?", [key])).rows[0];
      return row ? row.value : fallback;
    },
    async setSetting(key, value) {
      await query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
    }
  });
}

async function openDatabase(dataDir, databaseUrl) {
  const explicit = arguments.length >= 2;
  if (!explicit) loadEnv(path.join(dataDir || ".", ".env"));
  const url = explicit ? String(databaseUrl || "").trim() : resolveDatabaseUrl();
  const database = url === "pg-env" ? await postgresDriver(null) : (isPostgres(url) ? await postgresDriver(url) : sqliteDriver(sqliteFile(dataDir, url)));
  if (database.driver === "postgres") {
    const file = path.join(dataDir || ".", "content.sqlite");
    if (fs.existsSync(file)) database.importedRows = await database.pullMissingFrom(file);
  }
  return database;
}

const POST_MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function decodeEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function plainText(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function postDate(meta) {
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(String(meta || "").trim());
  const month = match ? POST_MONTHS[match[1].slice(0, 3).toLowerCase()] : undefined;
  if (!match || month == null) return "2016-01-01T00:00:00.000Z";
  return new Date(Date.UTC(Number(match[3]), month, Number(match[2]), 12)).toISOString();
}

function parseStaticPost(html, slug) {
  const title = plainText((String(html || "").match(/<h1>([\s\S]*?)<\/h1>/) || [])[1]);
  if (!title || !slug || slug.startsWith("_")) return null;
  const meta = plainText((html.match(/<p class="meta">([\s\S]*?)<\/p>/) || [])[1]);
  const prose = (html.match(/<div class="prose">([\s\S]*?)<\/div>/) || [])[1] || "";
  const blocks = [];
  const pattern = /<(p|h2)>([\s\S]*?)<\/\1>/g;
  let found;
  while ((found = pattern.exec(prose))) {
    const text = plainText(found[2]);
    if (text) blocks.push(text);
  }
  const imageMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+)"/);
  return {
    slug: slug,
    title: title.slice(0, 180),
    excerpt: (blocks[0] || "").slice(0, 400),
    body: blocks.join("\n\n").slice(0, 20000),
    url: "/post/" + slug,
    image: imageMatch ? imageMatch[1] : "",
    createdAt: postDate(meta)
  };
}

module.exports = { openDatabase, driverFor, isPostgres, sqliteFile, loadEnv, resolveDatabaseUrl, parseStaticPost, DEFAULT_STATS };

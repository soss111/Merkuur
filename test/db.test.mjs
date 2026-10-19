import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { driverFor, loadEnv, openDatabase, parseStaticPost, resolveDatabaseUrl } from "../db.js";

test("DATABASE_URL selects postgres or a sqlite file", () => {
  const local = driverFor("", "/tmp/merkuur-data");
  assert.equal(local.driver, "sqlite");
  assert.equal(local.file, "/tmp/merkuur-data/content.sqlite");

  const pg = driverFor("postgres://merkuur:secret@127.0.0.1:5432/merkuur", "/tmp/merkuur-data");
  assert.equal(pg.driver, "postgres");
  assert.equal(pg.label, "postgres merkuur");
  assert.equal(pg.file, undefined);

  const file = driverFor("sqlite:///var/lib/merkuur/merkuur.db", "/tmp/merkuur-data");
  assert.equal(file.driver, "sqlite");
  assert.equal(file.file, "/var/lib/merkuur/merkuur.db");
  const plain = driverFor("/srv/data/merkuur.sqlite", "/tmp/merkuur-data");
  assert.equal(plain.file, "/srv/data/merkuur.sqlite");
  assert.equal(file.label.includes("secret"), false);
});

test("an empty catalog is filled once from the public page", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-seed-"));
  const db = await openDatabase(dir, "");
  await db.seedCatalogOnce();
  await db.seedCatalogOnce();
  const content = await db.readContent();
  assert.equal(content.services.length, 6);
  assert.equal(content.services[0].title, "Töötoad");
  assert.equal(content.services[0].href, "/tootoad");
  assert.equal(content.services[5].title, "Karjääriteemad");
  assert.equal(content.news.length, 3);
  assert.equal(content.news[0].title, "Tule töötuppa! Või muidu tuleb töötuba sinu juurde!");
  assert.equal(content.news[0].url, "/post/tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde-1");
  assert.equal(content.news[0].body, "");
  assert.equal(content.gallery.length, 4);
  assert.equal(content.gallery[0].caption, "Neeme küla");
  assert.equal(content.gallery[3].caption, "Ida-Viru projekt");
  assert.equal(content.roadmap.length, 5);
  assert.equal(content.roadmap[0].title, "Tutvumine");
  assert.equal(content.roadmap[0].tag, "Tasuta vestlus");
  assert.equal(content.roadmap[4].title, "Tugi ja areng");
  assert.equal(content.people.length, 8);
  assert.equal(content.people[0].name, "Liis Proos");
  assert.equal(content.people[0].email, "info@merkuur.eu");
  assert.equal(content.people[7].name, "Lauri Soosaar");
  assert.equal(content.people[7].role, "Kaasasutaja");
  assert.deepEqual(content.testimonials, []);
  assert.deepEqual(content.milestones, []);
  assert.equal(content.stats.workshops, "3500+");
  assert.equal(content.stats.youth, "30 000");
  assert.equal(content.stats.asOf, "detsember 2023");
});

test("an app .env supplies DATABASE_URL when the process has none", () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousPort = process.env.PORT;
  try {
    delete process.env.DATABASE_URL;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-env-"));
    fs.writeFileSync(path.join(dir, ".env"), "export DATABASE_URL=\"postgres://merkuur:secret@127.0.0.1:5432/merkuur\"\n# comment\nPORT=1\n");
    process.env.PORT = "9999";
    loadEnv(path.join(dir, ".env"));
    const target = driverFor(process.env.DATABASE_URL, dir);
    assert.equal(target.driver, "postgres");
    assert.equal(target.label, "postgres merkuur");
    assert.equal(process.env.PORT, "9999");

    process.env.DATABASE_URL = "";
    const keep = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-env-keep-"));
    fs.writeFileSync(path.join(keep, ".env"), "DATABASE_URL=postgres://merkuur:secret@127.0.0.1:5432/merkuur\n");
    loadEnv(path.join(keep, ".env"));
    assert.equal(process.env.DATABASE_URL, "postgres://merkuur:secret@127.0.0.1:5432/merkuur");
    assert.equal(driverFor(resolveDatabaseUrl(), keep).driver, "postgres");
    process.env.DATABASE_URL = "postgres://other:secret@127.0.0.1:5432/other";
    loadEnv(path.join(keep, ".env"));
    assert.equal(process.env.DATABASE_URL, "postgres://other:secret@127.0.0.1:5432/other");
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
  }
});

test("rows written to sqlite are copied into the database HSL shows", async () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-src-"));
  const source = await openDatabase(sourceDir, "");
  await source.insertFeedback({
    id: "feed-1",
    quote: "Väga hea töötuba",
    name: "Mari",
    role: "õpetaja",
    org: "Kool",
    createdAt: "2026-10-18T12:00:00.000Z"
  });
  await source.insertStep({
    id: "step-9",
    title: "Uus etapp",
    detail: "Lisatud lehelt",
    tag: "Uus",
    createdAt: "2026-10-18T12:00:01.000Z"
  });
  await source.insertMilestone({
    id: "mile-1",
    period: "2026",
    title: "Uus tegevus",
    detail: "Lisatud lehelt",
    href: "/tootoad",
    image: "",
    createdAt: "2026-10-18T12:00:02.000Z"
  });
  await source.insertInquiry({
    id: "inq-1",
    name: "Mari Mets",
    phone: "+37255550000",
    email: "mari@kool.ee",
    service: "Töötuba",
    topics: "Metall, Puit",
    participants: "20",
    when: "märts",
    place: "Tartu",
    message: "Tuleme kooli",
    createdAt: "2026-10-18T12:00:03.000Z"
  });
  await source.saveCopy({ "hero:h1:1": "Uus pealkiri" });
  await source.saveAddress("Tartu");

  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-dst-"));
  const dest = await openDatabase(destDir, "");
  await dest.saveStats({ since: "2016", workshops: "1", youth: "2", mobiles: "3", solutions: "4", asOf: "jaanuar" });
  const copied = await dest.pullMissingFrom(path.join(sourceDir, "content.sqlite"));
  assert.equal(copied, 6);
  const again = await dest.pullMissingFrom(path.join(sourceDir, "content.sqlite"));
  assert.equal(again, 0);
  const content = await dest.readContent();
  assert.equal(content.testimonials.length, 1);
  assert.equal(content.testimonials[0].name, "Mari");
  assert.equal(content.roadmap.some((item) => item.title === "Uus etapp"), true);
  assert.equal(content.milestones.length, 1);
  assert.equal(content.milestones[0].title, "Uus tegevus");
  const inbox = await dest.listInquiries();
  assert.equal(inbox.total, 1);
  assert.equal(inbox.inquiries[0].name, "Mari Mets");
  assert.equal(inbox.inquiries[0].topics, "Metall, Puit");
  assert.equal(inbox.inquiries[0].place, "Tartu");
  assert.equal(content.copy["hero:h1:1"], "Uus pealkiri");
  assert.equal(content.address, "Tartu");
  assert.equal(content.stats.workshops, "1");
});

test("blog files fill empty post rows and leave an edited post alone", async () => {
  const parsed = parseStaticPost(
    "<h1>Ida-Viru projektis osales kokku 354 osalejat</h1><p class=\"meta\">Dec 1, 2024</p><div class=\"prose\"><p>27 õpituba 354le noorele.</p><h2>Partnerid</h2><p>Aitäh.</p></div><img src=\"https://example.com/a.jpg\">",
    "ida-viru-projektis-osales-kokku-354-osalejat"
  );
  assert.equal(parsed.createdAt, "2024-12-01T12:00:00.000Z");
  assert.match(parsed.body, /354le noorele/);
  assert.match(parsed.body, /Partnerid/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-posts-"));
  const database = await openDatabase(dir, "");
  await database.seedCatalogOnce();
  await database.importPosts([Object.assign({ id: "aabbccddeeff0011" }, parsed)]);
  const filled = await database.postBySlug(parsed.slug);
  assert.match(filled.body, /354le noorele/);
  assert.equal(filled.title, "Ida-Viru projektis osales kokku 354 osalejat");
  assert.equal(filled.image.startsWith("https://static.wixstatic.com/"), true);
  await database.insertPost({
    id: "cafebabe00000001",
    slug: "oma-postitus",
    title: "Oma pealkiri",
    excerpt: "juba",
    body: "hoia see alles",
    url: "/post/oma-postitus",
    image: "https://example.com/kept.jpg",
    createdAt: "2024-01-01T00:00:00.000Z"
  });
  await database.importPosts([{
    id: "ffffffffffffffff",
    slug: "oma-postitus",
    title: "Teine",
    excerpt: "uus",
    body: "asenda",
    url: "/post/oma-postitus",
    image: "https://example.com/new.jpg",
    createdAt: "2020-01-01T00:00:00.000Z"
  }]);
  const kept = await database.postBySlug("oma-postitus");
  assert.equal(kept.body, "hoia see alles");
  assert.equal(kept.title, "Oma pealkiri");
  assert.equal(kept.image, "https://example.com/kept.jpg");
  const again = await database.readContent();
  assert.equal(again.news.filter((item) => item.slug === parsed.slug).length, 1);
});

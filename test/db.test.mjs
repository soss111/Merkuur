import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { driverFor, loadEnv, openDatabase, resolveDatabaseUrl } from "../db.js";

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
  assert.deepEqual(content.testimonials, []);
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
  await source.saveCopy({ "hero:h1:1": "Uus pealkiri" });
  await source.saveAddress("Tartu");

  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "merkuur-dst-"));
  const dest = await openDatabase(destDir, "");
  await dest.saveStats({ since: "2016", workshops: "1", youth: "2", mobiles: "3", solutions: "4", asOf: "jaanuar" });
  const copied = await dest.pullMissingFrom(path.join(sourceDir, "content.sqlite"));
  assert.equal(copied, 4);
  const again = await dest.pullMissingFrom(path.join(sourceDir, "content.sqlite"));
  assert.equal(again, 0);
  const content = await dest.readContent();
  assert.equal(content.testimonials.length, 1);
  assert.equal(content.testimonials[0].name, "Mari");
  assert.equal(content.roadmap.some((item) => item.title === "Uus etapp"), true);
  assert.equal(content.copy["hero:h1:1"], "Uus pealkiri");
  assert.equal(content.address, "Tartu");
  assert.equal(content.stats.workshops, "1");
});

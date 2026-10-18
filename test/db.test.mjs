import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { driverFor, openDatabase } from "../db.js";

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

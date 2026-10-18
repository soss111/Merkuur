import assert from "node:assert/strict";
import test from "node:test";
import { driverFor } from "../db.js";

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

const test = require("node:test");
const assert = require("node:assert/strict");
const { HEADERS, buildRows } = require("../app/src/main/assets/sheets-sync.js");

const sample = {
  customers: [{ id: "c1", name: "রহিম", rate: 45, openingDue: 100, active: true }],
  meals: { "2026-11-20": { c1: 2 } },
  mealRates: { "2026-11-20": { c1: 40 } },
  payments: [{ id: "p1", date: "2026-11-20", cid: "c1", amount: 80, method: "নগদ" }],
  expenses: [{ id: "e1", date: "2026-11-20", title: "বাজার", category: "খাবার", amount: 50 }],
  syncTombstones: [{ opId: "d1", recordType: "payment", recordId: "p0", deleted: true, deletedAt: "2026-11-20T10:00:00Z", deviceId: "phone-a" }]
};

test("exports the versioned 17-column schema", () => {
  const rows = buildRows(sample, { updatedAt: "2026-11-20T12:00:00Z", deviceId: "phone-a" });
  assert.deepEqual(rows[0], HEADERS);
  assert.equal(rows[0].length, 17);
  assert.ok(rows.every(row => row.length === 17));
});

test("preserves all canonical record categories and meal historical rate", () => {
  const rows = buildRows(sample, { updatedAt: "2026-11-20T12:00:00Z", deviceId: "phone-a" });
  const types = rows.slice(1).map(row => row[1]);
  assert.deepEqual(types, ["customer", "meal", "payment", "expense", "deletion"]);
  const meal = rows.find(row => row[1] === "meal");
  assert.equal(meal[7], 2);
  assert.equal(meal[8], 40);
  assert.equal(meal[9], 80);
  assert.equal(JSON.parse(meal[12]).customerId, "c1");
});

test("operation IDs are stable across retries but change when record content changes", () => {
  const first = buildRows(sample, { updatedAt: "2026-11-20T12:00:00Z", deviceId: "phone-a" });
  const retry = buildRows(sample, { updatedAt: "2026-11-20T12:05:00Z", deviceId: "phone-b" });
  assert.equal(first[1][16], retry[1][16]);
  const changed = structuredClone(sample);
  changed.customers[0].rate = 47;
  const next = buildRows(changed, { updatedAt: "2026-11-20T12:06:00Z", deviceId: "phone-a" });
  assert.notEqual(first[1][16], next[1][16]);
});

test("does not mutate the source database", () => {
  const before = JSON.stringify(sample);
  buildRows(sample, { updatedAt: "2026-11-20T12:00:00Z", deviceId: "phone-a" });
  assert.equal(JSON.stringify(sample), before);
});

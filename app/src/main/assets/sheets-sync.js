(function (root) {
  "use strict";

  const SCHEMA_VERSION = "2";
  const HEADERS = [
    "schema_version", "record_type", "record_id", "month", "date",
    "member_id", "member_name", "quantity", "unit_rate", "amount",
    "category", "description", "payload_json", "updated_at", "device_id",
    "deleted", "operation_id"
  ];

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableJson(value[k])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  // Compact deterministic idempotency identifier; not a security checksum.
  function fingerprint(value) {
    const input = stableJson(value);
    let a = 2166136261, b = 0x9e3779b9;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619);
      b = Math.imul(b ^ (c + i), 2246822519);
    }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }

  function makeRow(type, id, payload, fields, context) {
    const data = payload && typeof payload === "object" ? payload : {};
    const date = fields.date || "";
    const deleted = !!fields.deleted;
    const opId = type + ":" + String(id) + ":" + fingerprint({ type, id: String(id), payload: data, deleted });
    return [
      SCHEMA_VERSION, type, String(id), date ? date.slice(0, 7) : "",
      date, fields.memberId || "", fields.memberName || "",
      fields.quantity ?? "", fields.unitRate ?? "", fields.amount ?? "",
      fields.category || "", fields.description || "",
      JSON.stringify(data), context.updatedAt, context.deviceId,
      deleted ? "TRUE" : "FALSE", opId
    ];
  }

  function buildRows(db, options) {
    if (!db || typeof db !== "object") throw new Error("ডেটাবেস পাওয়া যায়নি");
    const context = {
      updatedAt: (options && options.updatedAt) || new Date().toISOString(),
      deviceId: String((options && options.deviceId) || "unknown-device")
    };
    const rows = [HEADERS.slice()];
    const customers = Array.isArray(db.customers) ? db.customers : [];
    const customerById = new Map(customers.map(c => [String(c.id), c]));

    customers.forEach(c => rows.push(makeRow("customer", c.id, c, {
      memberId: c.id, memberName: c.name, amount: c.openingDue
    }, context)));

    const meals = db.meals && typeof db.meals === "object" ? db.meals : {};
    const rates = db.mealRates && typeof db.mealRates === "object" ? db.mealRates : {};
    Object.keys(meals).sort().forEach(date => {
      const daily = meals[date] || {};
      Object.keys(daily).sort().forEach(cid => {
        const customer = customerById.get(String(cid)) || {};
        const payload = { date, customerId: cid, quantity: daily[cid], unitRate: (rates[date] || {})[cid] ?? customer.rate ?? 0 };
        rows.push(makeRow("meal", date + ":" + cid, payload, {
          date, memberId: cid, memberName: customer.name,
          quantity: payload.quantity, unitRate: payload.unitRate,
          amount: Number(payload.quantity || 0) * Number(payload.unitRate || 0)
        }, context));
      });
    });

    (Array.isArray(db.payments) ? db.payments : []).forEach(p => rows.push(makeRow("payment", p.id, p, {
      date: p.date, memberId: p.cid,
      memberName: (customerById.get(String(p.cid)) || {}).name,
      amount: p.amount, category: p.method
    }, context)));

    (Array.isArray(db.expenses) ? db.expenses : []).forEach(e => rows.push(makeRow("expense", e.id, e, {
      date: e.date, amount: e.amount, category: e.category, description: e.title
    }, context)));

    (Array.isArray(db.syncTombstones) ? db.syncTombstones : []).forEach(t => rows.push(makeRow(
      "deletion", t.recordType + ":" + t.recordId + ":" + t.opId,
      t, { date: t.deletedAt ? String(t.deletedAt).slice(0, 10) : "", deleted: true },
      context
    )));
    return rows;
  }


  // Build a canonical map so every save can journal edits AND deletions.
  function canonicalRecords(db) {
    const out = new Map();
    (Array.isArray(db.customers) ? db.customers : []).forEach(x => out.set("customer:" + x.id, { type: "customer", id: String(x.id), payload: x }));
    const meals = db.meals && typeof db.meals === "object" ? db.meals : {};
    const rates = db.mealRates && typeof db.mealRates === "object" ? db.mealRates : {};
    Object.keys(meals).forEach(date => Object.keys(meals[date] || {}).forEach(cid => out.set("meal:" + date + ":" + cid, {
      type: "meal", id: date + ":" + cid,
      payload: { date, customerId: String(cid), quantity: meals[date][cid], unitRate: (rates[date] || {})[cid] ?? 0 }
    })));
    (Array.isArray(db.payments) ? db.payments : []).forEach(x => out.set("payment:" + x.id, { type: "payment", id: String(x.id), payload: x }));
    (Array.isArray(db.expenses) ? db.expenses : []).forEach(x => out.set("expense:" + x.id, { type: "expense", id: String(x.id), payload: x }));
    return out;
  }

  function captureOperations(previousDb, currentDb, options) {
    if (!currentDb || typeof currentDb !== "object") throw new Error("বর্তমান ডেটাবেস পাওয়া যায়নি");
    const previous = canonicalRecords(previousDb || {});
    const current = canonicalRecords(currentDb);
    const meta = currentDb.sheetsSyncMeta && typeof currentDb.sheetsSyncMeta === "object"
      ? currentDb.sheetsSyncMeta : (currentDb.sheetsSyncMeta = {});
    if (!meta.deviceId) {
      const random = Math.random().toString(36).slice(2, 10);
      meta.deviceId = "device-" + Date.now().toString(36) + "-" + random;
    }
    if (!Number.isSafeInteger(meta.nextSequence) || meta.nextSequence < 1) meta.nextSequence = 1;
    if (!Array.isArray(currentDb.sheetsOperationLog)) currentDb.sheetsOperationLog = [];
    const known = new Set(currentDb.sheetsOperationLog.map(x => x && x.opId).filter(Boolean));
    const changedKeys = new Set([...previous.keys(), ...current.keys()]);
    const now = (options && options.updatedAt) || new Date().toISOString();
    const added = [];
    changedKeys.forEach(key => {
      const before = previous.get(key), after = current.get(key);
      if (before && after && stableJson(before.payload) === stableJson(after.payload)) return;
      const record = after || before;
      const opId = meta.deviceId + ":" + meta.nextSequence++;
      if (known.has(opId)) throw new Error("অপারেশন আইডি পুনরায় তৈরি হয়েছে");
      const operation = {
        opId, recordType: record.type, recordId: record.id,
        payload: after ? after.payload : before.payload,
        deleted: !after, updatedAt: now, deviceId: meta.deviceId
      };
      currentDb.sheetsOperationLog.push(operation);
      known.add(opId);
      added.push(operation);
    });
    return added;
  }

  function buildOperationRows(db) {
    const rows = [HEADERS.slice()];
    (Array.isArray(db && db.sheetsOperationLog) ? db.sheetsOperationLog : []).forEach(op => {
      const payload = op.payload && typeof op.payload === "object" ? op.payload : {};
      const date = payload.date || (op.deletedAt ? String(op.deletedAt).slice(0, 10) : "");
      rows.push(makeRow(op.recordType, op.recordId, payload, {
        date, memberId: payload.cid || payload.customerId || "",
        memberName: payload.name || "", quantity: payload.quantity,
        unitRate: payload.unitRate, amount: payload.amount,
        category: payload.category || payload.method || "",
        description: payload.title || "", deleted: !!op.deleted
      }, { updatedAt: op.updatedAt || "", deviceId: op.deviceId || "unknown-device" }).map((v, i) => i === 16 ? op.opId : v));
    });
    return rows;
  }

  const api = { SCHEMA_VERSION, HEADERS, buildRows, captureOperations, buildOperationRows, fingerprint };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MillHisabSheetsSerializer = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

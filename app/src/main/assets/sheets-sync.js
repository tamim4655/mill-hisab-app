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

  const api = { SCHEMA_VERSION, HEADERS, buildRows, fingerprint };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MillHisabSheetsSerializer = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

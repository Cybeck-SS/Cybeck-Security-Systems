const { randomUUID } = require("crypto");

const urgencies = ["critical", "high", "normal", "low"];
const sources = ["general", "network", "operations"];
const states = ["open", "in-progress", "done"];
const string = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";

function normalizeItem(item, type) {
    if (!item || typeof item !== "object") return null;
    const title = string(item.title, 120);
    if (!title) return null;
    const urgency = urgencies.includes(item.urgency) ? item.urgency : "normal";
    const source = sources.includes(item.source) ? item.source : "general";
    const now = new Date().toISOString();
    return {
        id: /^[0-9a-f-]{36}$/i.test(item.id || "") ? item.id : randomUUID(),
        title, body: string(item.body, 10000), urgency, source,
        reference: string(item.reference, 180),
        status: type === "task" && states.includes(item.status) ? item.status : "open",
        due: type === "task" ? date(item.due) : "",
        createdAt: !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : now,
        updatedAt: !Number.isNaN(Date.parse(item.updatedAt)) ? item.updatedAt : now
    };
}

function normalizeWorkItems(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) || input.schema !== 1 || !Array.isArray(input.tasks) || !Array.isArray(input.notes)) throw new Error("Invalid work items file.");
    return {
        schema: 1,
        tasks: (Array.isArray(input.tasks) ? input.tasks : []).slice(0, 500).map((x) => normalizeItem(x, "task")).filter(Boolean),
        notes: (Array.isArray(input.notes) ? input.notes : []).slice(0, 500).map((x) => normalizeItem(x, "note")).filter(Boolean)
    };
}

module.exports = { normalizeWorkItems };

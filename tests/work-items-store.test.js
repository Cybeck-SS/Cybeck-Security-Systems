const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeWorkItems } = require("../work-items-store");

test("work items preserve editable task and note fields", () => {
    const data = normalizeWorkItems({ schema: 1, tasks: [{ title: "Check gateway", urgency: "high", source: "network", status: "in-progress", due: "2026-09-22", body: "Compare routes" }], notes: [{ title: "Observation", urgency: "critical", source: "operations", body: "Reviewed console output" }] });
    assert.equal(data.tasks[0].status, "in-progress");
    assert.equal(data.tasks[0].due, "2026-09-22");
    assert.equal(data.notes[0].urgency, "critical");
    assert.equal(data.notes[0].source, "operations");
});

test("invalid import cannot replace local work items", () => {
    assert.throws(() => normalizeWorkItems({}), /Invalid work items/);
    assert.throws(() => normalizeWorkItems({ schema: 1, tasks: {}, notes: [] }), /Invalid work items/);
});

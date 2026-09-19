const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Exercise the actual session engine with controlled scan times, without
// starting Electron or relying on the machine's network state.
const renderer = fs.readFileSync(path.join(__dirname, "..", "renderer.js"), "utf8");
const start = renderer.indexOf("function formatSessionClock(");
const end = renderer.indexOf('document.querySelectorAll("[data-event-filter]")', start);
assert.ok(start >= 0 && end > start, "session engine source was found");

function createSession() {
    let now = 0;
    const displayed = new Map();
    const context = vm.createContext({
        Date: class extends Date { static now() { return now; } },
        Math, Number, Object, String,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        document: { dispatchEvent() {} },
        activeSecurityConditions: new Set(),
        setNetworkText: (id, value) => displayed.set(id, String(value)),
        formatSecurityDuration: (ms) => `${Math.round(ms / 1000)}s`
    });
    vm.runInContext(renderer.slice(start, end), context);
    return {
        scan(at, connected, internet, signal = 80, ssid = "Home", gateway = "192.0.2.1") {
            now = at;
            context.sample = { connected, internet, signal, ssid, gateway, connectionType: "Wi-Fi" };
            vm.runInContext("updateSessionStatistics(sample)", context);
        },
        value(id) { return displayed.get(`session-${id}`); }
    };
}

test("overlapping internet and network loss counts downtime once", () => {
    const session = createSession();
    session.scan(1000, true, true, 80);
    session.scan(6000, true, false, 75);
    session.scan(11000, false, false, 0);
    session.scan(16000, true, false, 60);
    session.scan(21000, true, true, 90);

    assert.equal(session.value("network-outages"), "1");
    assert.equal(session.value("internet-outages"), "2");
    assert.equal(session.value("total-downtime"), "00:00:15");
    assert.equal(session.value("longest-outage"), "00:00:15");
    assert.equal(session.value("recovery-time"), "15s");
    assert.equal(session.value("reliability"), "25.0%");
    assert.equal(session.value("lowest-signal"), "60%");
    assert.equal(session.value("average-signal"), "76%");
});

test("network and gateway changes require observed valid identities", () => {
    const session = createSession();
    session.scan(1000, true, true, 80);
    session.scan(6000, true, true, 80, "Office", "192.0.2.2");
    session.scan(11000, false, false, 0, "Unavailable", "Unavailable");
    session.scan(16000, true, true, 80, "Cafe", "192.0.2.3");

    assert.equal(session.value("network-changes"), "1");
    assert.equal(session.value("gateway-changes"), "1");
    assert.equal(session.value("network-outages"), "1");
});

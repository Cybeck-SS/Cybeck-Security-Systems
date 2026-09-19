const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeConnections, findConnectionObservations, parseNetstatAttempts } = require("../security-core");

test("first connection scan establishes a baseline", () => {
    const rows = normalizeConnections([{ protocol: "TCP", processId: 42, process: "service.exe",
        localAddress: "0.0.0.0", localPort: 8080, state: "Listen" }]);
    assert.deepEqual(findConnectionObservations(null, rows), []);
    assert.deepEqual(findConnectionObservations(rows, rows), []);
});

test("new listeners and unidentified processes are observations", () => {
    const baseline = normalizeConnections([]);
    const current = normalizeConnections([
        { protocol: "TCP", processId: 42, process: "service.exe", localAddress: "0.0.0.0", localPort: 8080, state: "Listen" },
        { protocol: "TCP", processId: 99, process: "Unknown", localAddress: "192.0.2.1", localPort: 51000,
            remoteAddress: "198.51.100.1", remotePort: 443, state: "Established" }
    ]);
    const observations = findConnectionObservations(baseline, current);
    assert.deepEqual(observations.map((item) => item.kind), ["new-listener", "unidentified-process"]);
    assert.deepEqual(observations.map((item) => item.severity), ["WARNING", "INFO"]);
});

test("high connection count is raised only when crossing the threshold", () => {
    const connections = (count) => normalizeConnections(Array.from({ length: count }, (_, index) => ({
        protocol: "TCP", processId: 7, process: "browser.exe", state: "Established",
        localAddress: "192.0.2.1", localPort: 50000 + index,
        remoteAddress: "198.51.100.1", remotePort: 443
    })));
    assert.equal(findConnectionObservations(connections(49), connections(50))
        .filter((item) => item.kind === "many-connections").length, 1);
    assert.equal(findConnectionObservations(connections(50), connections(51))
        .filter((item) => item.kind === "many-connections").length, 0);
});

test("TCP attempt parser accepts SYN_SENT without treating listeners as attempts", () => {
    const output = `  Proto  Local Address  Foreign Address  State  PID\r\n  TCP    192.0.2.1:50123  198.51.100.9:443  SYN_SENT  42\r\n  TCP    0.0.0.0:80  0.0.0.0:0  LISTENING  4`;
    assert.deepEqual(parseNetstatAttempts(output), [{
        localEndpoint: "192.0.2.1:50123", remoteEndpoint: "198.51.100.9:443",
        state: "SYN_SENT", processId: 42
    }]);
});

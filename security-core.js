// Local, read-only connection analysis. No packet capture or traffic blocking.
const MAX_CONNECTIONS = 300;

function normalizeConnections(input) {
    const rows = Array.isArray(input) ? input : input ? [input] : [];
    return rows.slice(0, MAX_CONNECTIONS).map((row) => ({
        protocol: row.protocol === "UDP" ? "UDP" : "TCP",
        processId: Number.isInteger(Number(row.processId)) ? Number(row.processId) : 0,
        process: String(row.process || "Unknown").slice(0, 120),
        localAddress: String(row.localAddress || "").slice(0, 80),
        localPort: Number(row.localPort) || 0,
        remoteAddress: String(row.remoteAddress || "").slice(0, 80),
        remotePort: Number(row.remotePort) || 0,
        state: String(row.state || "Unknown").slice(0, 40)
    }));
}

function connectionKey(row) {
    return [row.protocol, row.processId, row.localAddress, row.localPort,
        row.remoteAddress, row.remotePort, row.state].join("|");
}

function findConnectionObservations(previous, current) {
    if (!previous) return []; // The first scan establishes a baseline.
    const before = new Set(previous.map(connectionKey));
    const observations = [];
    for (const row of current) {
        if (before.has(connectionKey(row))) continue;
        if (row.protocol === "TCP" && row.state === "Listen") {
            observations.push({
                kind: "new-listener",
                severity: "WARNING",
                title: `New listening port ${row.localPort}`,
                detail: `${row.process} (PID ${row.processId}) opened ${row.localAddress}:${row.localPort}.`,
                connection: row
            });
        } else if (row.process === "Unknown" && row.state === "Established") {
            observations.push({
                kind: "unidentified-process",
                severity: "INFO",
                title: "Connection with unidentified process",
                detail: `PID ${row.processId} connected to ${row.remoteAddress}:${row.remotePort}. Process identification may be unavailable.`,
                connection: row
            });
        } else if (row.state === "Established" && row.remotePort &&
            ![22, 25, 53, 80, 123, 443, 587, 993, 995, 8080, 8443].includes(row.remotePort) &&
            row.remoteAddress && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:)/i.test(row.remoteAddress)) {
            observations.push({
                kind: "uncommon-destination-port",
                severity: "INFO",
                title: "Connection to uncommon destination port",
                detail: `${row.process} (PID ${row.processId}) connected to ${row.remoteAddress}:${row.remotePort}. The port is less common, which alone is not suspicious.`,
                connection: row
            });
        }
    }
    const counts = new Map();
    for (const row of current) {
        if (row.state !== "Established") continue;
        counts.set(row.processId, (counts.get(row.processId) || 0) + 1);
    }
    for (const [pid, count] of counts) {
        const prior = previous.filter((row) => row.processId === pid && row.state === "Established").length;
        if (count >= 50 && prior < 50) {
            const row = current.find((item) => item.processId === pid);
            observations.push({
                kind: "many-connections",
                severity: "WARNING",
                title: "High connection count",
                detail: `${row.process} (PID ${pid}) has ${count} established connections. This may be normal for browsers or sync tools.`,
                connection: row
            });
        }
    }
    return observations.slice(0, 20);
}

function parseNetstatAttempts(output) {
    return String(output).split(/\r?\n/).map((line) => line.trim().match(/^TCP\s+(\S+)\s+(\S+)\s+(SYN_SENT)\s+(\d+)$/i))
        .filter(Boolean).map((match) => ({
            localEndpoint: match[1], remoteEndpoint: match[2],
            state: "SYN_SENT", processId: Number(match[4])
        }));
}

module.exports = { normalizeConnections, connectionKey, findConnectionObservations, parseNetstatAttempts };

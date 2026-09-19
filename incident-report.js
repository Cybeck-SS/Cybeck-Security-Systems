function escapeHtml(value) {
    return String(value ?? "--").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function renderIncidentReport(report) {
    const field = (name, value) => `<div class="field"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`;
    const dateLabel = (value) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : `${parsed.toISOString().slice(0, 19).replace("T", " ")} UTC`;
    };
    const duration = Number.isFinite(Number(report.durationMs))
        ? `${Math.round(Number(report.durationMs) / 1000)} seconds` : "Unavailable";
    const timeline = (Array.isArray(report.timeline) ? report.timeline : []).slice(0, 100)
        .map((entry) => `<tr><td>${escapeHtml(dateLabel(entry.time))}</td><td>${escapeHtml(entry.action)}</td></tr>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(report.id)} Incident Report</title>
<style>
@page { size: A4; margin: 15mm 18mm 20mm; }
* { box-sizing: border-box; }
body { font: 11px/1.5 "Segoe UI", Arial, sans-serif; color: #1d271d; margin: 0; }
header { border-bottom: 3px solid #91a64f; padding-bottom: 14px; margin-bottom: 24px; }
.brand { color: #53672c; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
h1 { font-size: 25px; margin: 8px 0 3px; color: #182119; }
.subtitle { color: #647063; }
.badge { display: inline-block; margin-top: 10px; padding: 5px 9px; border-radius: 5px; background: #e7edda; color: #3d5421; font-weight: 700; }
h2 { font-size: 13px; margin: 24px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #dce4d6; color: #354b24; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
.field { padding: 7px 0; border-bottom: 1px solid #e8ede3; break-inside: avoid; }
.field span { display: block; color: #677365; font-size: 9px; text-transform: uppercase; letter-spacing: .7px; }
.field strong { display: block; overflow-wrap: anywhere; font-size: 11px; }
.box { border: 1px solid #dce4d6; border-left: 3px solid #91a64f; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; }
th { text-align: left; color: #53672c; background: #edf1e8; }
th, td { padding: 7px 9px; border-bottom: 1px solid #e2e8dc; vertical-align: top; overflow-wrap: anywhere; }
td:first-child { width: 165px; color: #5c6959; }
tr { break-inside: avoid; }
footer { position: fixed; bottom: 0; left: 0; right: 0; padding-top: 8px; border-top: 1px solid #dce4d6; color: #788475; font-size: 9px; }
</style></head><body>
<header><div class="brand">CYBECK SECURITY SYSTEMS</div><h1>Incident ${escapeHtml(report.id)}</h1>
<div class="subtitle">Local network observation report · Exported ${escapeHtml(dateLabel(report.exportedAt))}</div>
<div class="badge">${escapeHtml(report.severity)} · ${escapeHtml(report.status)}</div></header>
<h2>Incident Overview</h2><div class="grid">
${field("Detected", dateLabel(report.detected))}${field("Last Updated", dateLabel(report.updated))}
${field("Duration", duration)}${field("Resolution", report.resolution)}
${field("Source", report.source)}${field("Device", report.device)}
${field("Network", report.network)}${field("Event", report.event)}</div>
<h2>Connection Evidence</h2><div class="grid">
${field("Process", report.process)}${field("PID", report.processId)}
${field("Local Address", report.localAddress)}${field("Remote Address", report.remoteAddress)}
${field("Remote Port", report.remotePort)}${field("Protocol", report.protocol)}</div>
<h2>Observation</h2><div class="box">${escapeHtml(report.evidence)}</div>
<h2>Analyst Notes</h2><div class="box">${escapeHtml(report.notes || "No analyst notes recorded.")}</div>
<h2>Timeline and Actions</h2><table><thead><tr><th>TIME</th><th>ACTION</th></tr></thead><tbody>${timeline || '<tr><td colspan="2">No timeline entries.</td></tr>'}</tbody></table>
<footer>Cybeck records local observations. An unusual connection or port is not proof of malicious activity. Review evidence before taking action.</footer>
</body></html>`;
}

module.exports = { renderIncidentReport, escapeHtml };

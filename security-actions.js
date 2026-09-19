const { isIP } = require("net");

function firewallTarget(incidentId, remoteAddress) {
    if (!/^CYB-\d{5}$/.test(incidentId || "") || !isIP(remoteAddress || "") ||
        ["0.0.0.0", "::", "::1"].includes(remoteAddress) || /^127\./.test(remoteAddress)) return null;
    return { name: `Cybeck-${incidentId}`, remoteAddress };
}

module.exports = { firewallTarget };

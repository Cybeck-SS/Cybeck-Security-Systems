function classifyConnectionType(adapter = {}) {
    const text = [adapter.Name, adapter.InterfaceDescription, adapter.MediaType, adapter.PhysicalMediaType]
        .filter(Boolean).join(" ").toLowerCase();
    if (/vpn|wireguard|openvpn|tunnel|\btap\b/.test(text)) return "VPN";
    if (/802\.11|wireless|wi[ -]?fi|\bwlan\b/.test(text)) return "Wi-Fi";
    if (/cellular|wwan|mobile broadband|lte|5g/.test(text)) return "Cellular";
    if (/bluetooth/.test(text)) return "Bluetooth";
    if (/802\.3|ethernet|gigabit|\blan\b/.test(text)) return "Ethernet";
    return "Other";
}

function chooseActiveAdapter(rows) {
    const candidates = (Array.isArray(rows) ? rows : rows ? [rows] : [])
        .filter((row) => row && String(row.Status).toLowerCase() === "up" && row.IPv4 && row.Gateway)
        .sort((a, b) => (Number(a.EffectiveMetric) || Number.MAX_SAFE_INTEGER) -
            (Number(b.EffectiveMetric) || Number.MAX_SAFE_INTEGER));
    if (!candidates.length) return null;
    return { ...candidates[0], ConnectionType: classifyConnectionType(candidates[0]) };
}

module.exports = { classifyConnectionType, chooseActiveAdapter };

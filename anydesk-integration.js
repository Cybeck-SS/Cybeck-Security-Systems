const DOWNLOAD_URL = "https://anydesk.com/en/downloads/windows";

function validateAnyDeskAddress(supplied) {
    const value = String(supplied || "").trim();
    const compactId = value.replace(/ /g, "");
    if (/^\d{9,10}$/.test(compactId)) return compactId;
    if (/^[a-z0-9][a-z0-9._-]{0,24}@[a-z0-9][a-z0-9._-]{0,24}$/i.test(value)) return value;
    throw new Error("Enter a 9–10 digit AnyDesk ID or an alias such as secondpc@ad.");
}

function sessionUri(supplied) {
    return `anydesk:${validateAnyDeskAddress(supplied)}`;
}

module.exports = { DOWNLOAD_URL, validateAnyDeskAddress, sessionUri };

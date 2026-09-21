const { randomBytes, scryptSync, timingSafeEqual, randomUUID } = require("crypto");

const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";

function createProfile(name, role, password) {
    const safeName = clean(name, 48);
    const safeRole = clean(role, 48) || "Vault user";
    if (!safeName) throw new Error("Profile name is required.");
    if (typeof password !== "string" || password.length < 10 || password.length > 256) throw new Error("Use a password between 10 and 256 characters.");
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 32);
    return { id: randomUUID(), name: safeName, role: safeRole, salt: salt.toString("base64"), hash: hash.toString("base64"), createdAt: new Date().toISOString() };
}

function verifyPassword(profile, password) {
    try {
        if (typeof password !== "string" || password.length > 256) return false;
        const expected = Buffer.from(profile.hash, "base64");
        const actual = scryptSync(password, Buffer.from(profile.salt, "base64"), expected.length);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
}

function publicProfile(profile) {
    return { id: profile.id, name: profile.name, role: profile.role, createdAt: profile.createdAt };
}

function normalizeVaultProfiles(value) {
    if (!value || value.schema !== 1 || !Array.isArray(value.profiles)) throw new Error("Invalid Vault profile store.");
    return { schema: 1, profiles: value.profiles.filter((profile) => profile && /^[0-9a-f-]{36}$/i.test(profile.id || "") && profile.name && profile.salt && profile.hash).slice(0, 8) };
}

module.exports = { createProfile, verifyPassword, publicProfile, normalizeVaultProfiles };

const path = require("path");

const HEADER = "CYBECK NOTE";
const safeLine = (value, limit = 180) => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, limit);

function renderNoteFile(note) {
    return [
        HEADER,
        `ID: ${safeLine(note.id, 36)}`,
        `TITLE: ${safeLine(note.title, 120)}`,
        `URGENCY: ${safeLine(note.urgency, 16)}`,
        `SOURCE: ${safeLine(note.source, 24)}`,
        `REFERENCE: ${safeLine(note.reference)}`,
        `CREATED: ${safeLine(note.createdAt, 40)}`,
        `UPDATED: ${safeLine(note.updatedAt, 40)}`,
        "",
        String(note.body || "").slice(0, 10000),
        ""
    ].join("\r\n");
}

function parseNoteFile(contents) {
    const text = String(contents || "").replace(/\r\n/g, "\n");
    const [header, ...rest] = text.split("\n");
    if (header.trim() !== HEADER) throw new Error("This is not a Cybeck note file.");
    const fields = {};
    let index = 0;
    for (; index < rest.length; index += 1) {
        const line = rest[index];
        if (!line.trim()) { index += 1; break; }
        const match = /^([A-Z]+):\s*(.*)$/.exec(line);
        if (match) fields[match[1]] = match[2];
    }
    if (!fields.TITLE) throw new Error("The note title is missing.");
    return {
        id: fields.ID,
        title: fields.TITLE,
        urgency: fields.URGENCY,
        source: fields.SOURCE,
        reference: fields.REFERENCE,
        createdAt: fields.CREATED,
        updatedAt: new Date().toISOString(),
        body: rest.slice(index).join("\n").replace(/\n$/, ""),
        status: "open",
        due: ""
    };
}

function noteFileName(note) {
    return `${safeLine(note.id, 36)}.txt`;
}

function historyFileName(date = new Date()) {
    return `${date.toISOString().replace(/[:.]/g, "-")}.txt`;
}

function noteFolder(documentsPath) {
    return path.join(documentsPath, "Cybeck Security Systems", "Notes");
}

module.exports = { renderNoteFile, parseNoteFile, noteFileName, historyFileName, noteFolder };

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderNoteFile, parseNoteFile, noteFileName } = require("../note-files");

test("Cybeck text notes round trip through a Notepad friendly file", () => {
    const note = { id: "12345678-1234-1234-1234-123456789abc", title: "Gateway follow-up", urgency: "high", source: "network", reference: "CYB-1", createdAt: "2026-09-21T10:00:00.000Z", updatedAt: "2026-09-21T10:05:00.000Z", body: "Line one\nLine two" };
    const parsed = parseNoteFile(renderNoteFile(note));
    assert.equal(parsed.id, note.id);
    assert.equal(parsed.title, note.title);
    assert.equal(parsed.urgency, "high");
    assert.equal(parsed.body, note.body);
    assert.equal(noteFileName(note), `${note.id}.txt`);
});

test("rejects unrelated text files", () => assert.throws(() => parseNoteFile("ordinary text"), /not a Cybeck note/i));

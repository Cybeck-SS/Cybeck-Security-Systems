const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = ["renderer.js", "security-operations.js", "operations-console.js", "remote-systems-ui.js", "work-items-ui.js", "vault-ui.js", "profile-session.js"]
    .map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

test("every labeled button has an implemented interaction contract", () => {
    const buttons = [...html.matchAll(/<button\b([^>]*)>/gi)].map((match) => match[1]);
    const dynamicIds = new Set(["task-new", "task-delete", "note-new", "note-delete"]);
    const sharedAttributes = ["data-page", "data-create-work", "data-work-export", "data-work-import", "data-vault-reveal", "data-event-filter", "data-network-repair"];
    const missing = [];
    for (const attributes of buttons) {
        const id = /\bid="([^"]+)"/i.exec(attributes)?.[1];
        if (id && !scripts.includes(id) && !dynamicIds.has(id)) missing.push(`#${id}`);
        if (!id) {
            const shared = sharedAttributes.find((attribute) => new RegExp(`\\b${attribute}(?:=|\\s|$)`, "i").test(attributes));
            const submit = /\btype="submit"/i.test(attributes);
            if (!shared && !submit) missing.push(attributes.trim());
            if (shared && !scripts.includes(shared)) missing.push(`[${shared}]`);
        }
    }
    assert.deepEqual(missing, []);
});

test("every form has a submit handler or a documented native action", () => {
    const forms = [...html.matchAll(/<form\b[^>]*\bid="([^"]+)"/gi)].map((match) => match[1]);
    const dynamicForms = new Set(["task-form", "note-form"]);
    const missing = forms.filter((id) => !scripts.includes(id) && !dynamicForms.has(id));
    assert.deepEqual(missing, []);
});

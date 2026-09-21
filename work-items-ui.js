(() => {
    const bridge = window.windowControls;
    if (!bridge?.loadWorkItems) return;
    const get = (id) => document.getElementById(id);
    const urgencies = ["critical", "high", "normal", "low"];
    const state = { schema: 1, tasks: [], notes: [] };
    let noteUrgency = "normal";
    let ready = false;
    let saving = Promise.resolve();
    const labels = { network: "Network Monitor", operations: "Operations", general: "General" };
    const statusLine = document.createElement("p");
    statusLine.className = "work-storage-status";
    statusLine.setAttribute("role", "status");
    get("tasks").querySelector(".work-header").after(statusLine);
    const announce = (message) => { statusLine.textContent = message; };

    function persist() {
        if (!ready) return;
        const snapshot = structuredClone(state);
        saving = saving.catch(() => {}).then(() => bridge.saveWorkItems(snapshot)).then((result) => {
            announce(result.saved ? "Saved locally with Windows encryption." : result.error || "Save failed.");
        }).catch((error) => announce(`Save failed: ${error.message}`));
    }

    function renderCycle() {
        const stage = get("note-cycle-stage");
        stage.replaceChildren();
        for (const [index, urgency] of urgencies.entries()) {
            const rawOffset = index - urgencies.indexOf(noteUrgency);
            const offset = ((rawOffset + 2 + urgencies.length) % urgencies.length) - 2;
            const card = document.createElement("button");
            card.type = "button";
            card.className = `note-cycle-card${offset === 0 ? " selected" : ""}`;
            card.style.setProperty("--cycle-offset", String(offset));
            card.style.setProperty("--cycle-x", `${offset * 78}px`);
            card.style.setProperty("--cycle-y", `${Math.abs(offset) * 13}px`);
            card.style.setProperty("--cycle-turn", `${offset * -8}deg`);
            card.style.setProperty("--cycle-scale", String(1 - Math.abs(offset) * .13));
            card.textContent = urgency.toUpperCase();
            card.setAttribute("aria-pressed", String(offset === 0));
            card.addEventListener("click", () => { noteUrgency = urgency; get("note-urgency").value = urgency; renderCycle(); renderNotes(); });
            stage.append(card);
        }
    }

    function itemCard(item, kind) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `work-item urgency-${item.urgency}`;
        const title = document.createElement("strong");
        title.textContent = item.title;
        const meta = document.createElement("small");
        meta.textContent = [item.urgency.toUpperCase(), labels[item.source], kind === "task" ? item.status.replace("-", " ") : "", item.due || ""].filter(Boolean).join(" · ");
        const description = document.createElement("span");
        description.textContent = item.body.slice(0, 140) || item.reference || "Open to edit";
        card.append(title, meta, description);
        card.addEventListener("click", () => editItem(kind, item));
        return card;
    }

    function renderTasks() {
        const list = get("tasks-list");
        list.replaceChildren();
        const status = get("task-filter").value;
        const source = get("task-source-filter").value;
        const items = state.tasks.filter((item) => (status === "all" || item.status === status) && (source === "all" || item.source === source));
        for (const item of items) list.append(itemCard(item, "task"));
        if (!items.length) list.textContent = "No tasks in this view.";
    }

    function renderNotes() {
        const list = get("notes-list");
        list.replaceChildren();
        const items = state.notes.filter((item) => item.urgency === noteUrgency);
        for (const item of items) list.append(itemCard(item, "note"));
        if (!items.length) list.textContent = `No ${noteUrgency} notes yet.`;
    }

    function editItem(kind, item) {
        const prefix = kind === "task" ? "task" : "note";
        for (const field of ["id", "title", "body", "urgency", "source", "reference", ...(kind === "task" ? ["status", "due"] : [])]) get(`${prefix}-${field}`).value = item[field] || "";
        get(`${prefix}-form-heading`).textContent = `Edit ${kind}`;
        get(`${prefix}-delete`).hidden = false;
        if (kind === "note") { noteUrgency = item.urgency; renderCycle(); renderNotes(); }
        get(prefix === "task" ? "tasks" : "notes").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function reset(kind, source = "general") {
        const prefix = kind === "task" ? "task" : "note";
        get(`${prefix}-form`).reset();
        get(`${prefix}-id`).value = "";
        get(`${prefix}-source`).value = source;
        get(`${prefix}-urgency`).value = kind === "note" ? noteUrgency : "normal";
        get(`${prefix}-form-heading`).textContent = `New ${kind}`;
        get(`${prefix}-delete`).hidden = true;
    }

    for (const kind of ["task", "note"]) {
        const prefix = kind;
        const collection = kind === "task" ? "tasks" : "notes";
        get(`${prefix}-form`).addEventListener("submit", (event) => {
            event.preventDefault();
            if (!ready) return;
            const id = get(`${prefix}-id`).value;
            const current = state[collection].find((item) => item.id === id);
            const item = {
                id: current?.id || crypto.randomUUID(), title: get(`${prefix}-title`).value.trim(), body: get(`${prefix}-body`).value,
                urgency: get(`${prefix}-urgency`).value, source: get(`${prefix}-source`).value, reference: get(`${prefix}-reference`).value,
                status: kind === "task" ? get("task-status").value : "open", due: kind === "task" ? get("task-due").value : "",
                createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
            };
            if (!item.title) return;
            if (!current && state[collection].length >= 500) { announce(`The ${collection} limit is 500. Export or delete an item before adding another.`); return; }
            if (current) Object.assign(current, item);
            else state[collection].unshift(item);
            if (kind === "note") { noteUrgency = item.urgency; renderCycle(); renderNotes(); }
            else renderTasks();
            persist();
            editItem(kind, item);
        });
        get(`${prefix}-new`).addEventListener("click", () => reset(kind));
        get(`${prefix}-delete`).addEventListener("click", () => {
            const id = get(`${prefix}-id`).value;
            if (!id || !window.confirm(`Delete this ${kind}?`)) return;
            state[collection] = state[collection].filter((item) => item.id !== id);
            reset(kind);
            kind === "task" ? renderTasks() : renderNotes();
            persist();
        });
    }

    get("task-filter").addEventListener("change", renderTasks);
    get("task-source-filter").addEventListener("change", renderTasks);
    for (const [id, step] of [["note-cycle-prev", -1], ["note-cycle-next", 1]]) get(id).addEventListener("click", () => {
        noteUrgency = urgencies[(urgencies.indexOf(noteUrgency) + step + urgencies.length) % urgencies.length];
        get("note-urgency").value = noteUrgency;
        renderCycle(); renderNotes();
    });
    get("note-urgency").addEventListener("change", (event) => { noteUrgency = event.target.value; renderCycle(); renderNotes(); });
    get("note-cycle-stage").addEventListener("wheel", (event) => {
        event.preventDefault();
        const step = event.deltaY > 0 ? 1 : -1;
        noteUrgency = urgencies[(urgencies.indexOf(noteUrgency) + step + urgencies.length) % urgencies.length];
        get("note-urgency").value = noteUrgency;
        renderCycle(); renderNotes();
    }, { passive: false });

    get("open-notes-folder")?.addEventListener("click", async () => {
        const result = await bridge.openNotesFolder();
        announce(result.error || "Opened the readable Notes folder in File Explorer.");
    });
    get("restore-note-file")?.addEventListener("click", async () => {
        const result = await bridge.importNoteFile();
        if (result.error) { announce(result.error); return; }
        if (!result.note) return;
        const existing = state.notes.find((note) => note.id === result.note.id);
        if (existing) Object.assign(existing, result.note);
        else state.notes.unshift(result.note);
        noteUrgency = result.note.urgency;
        renderCycle(); renderNotes(); persist(); editItem("note", existing || result.note);
        announce("Note restored from the selected text file.");
    });

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-create-work]");
        if (!button) return;
        const kind = button.dataset.createWork;
        reset(kind, button.dataset.workSource);
        if (button.dataset.workTitle) get(`${kind}-title`).value = button.dataset.workTitle;
        if (button.dataset.workReference) get(`${kind}-reference`).value = button.dataset.workReference;
        openPage(kind === "task" ? "tasks" : "notes");
        get(`${kind}-title`).focus();
    });
    document.querySelectorAll("[data-work-export]").forEach((button) => button.addEventListener("click", async () => {
        await saving;
        const result = await bridge.exportWorkItems(state);
        announce(result.saved ? "JSON export saved. Keep this readable file private before placing it in a cloud drive." : result.canceled ? "Export canceled." : result.error || "Export failed.");
    }));
    document.querySelectorAll("[data-work-import]").forEach((button) => button.addEventListener("click", async () => {
        const result = await bridge.importWorkItems();
        if (result.error) { announce(result.error); return; }
        if (!result.data || !window.confirm("Replace all local Tasks and Notes with this imported file?")) return;
        Object.assign(state, result.data);
        renderTasks(); renderNotes(); persist();
        reset("task"); reset("note");
    }));

    bridge.loadWorkItems().then((result) => {
        if (result.error) { announce(result.error); return; }
        Object.assign(state, result);
        ready = true;
        announce("Saved locally with Windows encryption. Export JSON to move data to a cloud drive later.");
        renderTasks(); renderNotes();
    }).catch((error) => announce(`Work items could not be loaded: ${error.message}`));
    renderCycle();
})();

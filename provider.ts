// Tab Vault
[Tabs.Vault]() {
    const header = this.header("Vault", "Create, edit, and view your personal curated list", [
        tray.flex([/* bottoni create/import */], { gap: 0 }),
    ]);

    const search = tray.input({
        placeholder: `Search...`,
        value: state.vaultSearch.get(),
        style: { borderRadius: "0.5rem", paddingInlineStart: "2.5rem" },
        onChange: ctx.eventHandler("search-query", (e) => {
            state.vaultSearch.set(String(e.value));
        }),
    });

    // 🔹 Qui togliamo lo sort alfabetico
    const entries = Object.values(vault.storage)
        .filter((x) =>
            state.vaultSearch.get().length
                ? `${x.name} ${x.entries.map((e) => e.title.synonyms).flat()}`.toLowerCase().includes(state.vaultSearch.get().toLowerCase())
                : true
        )
        .map(this.formatShelfItem);

    const body = tray.stack(entries.length ? entries : [this.noEntries()], { style: { height: "25rem", overflowY: "scroll" } });

    return tray.stack([this.overlay(), header, search, body], { style: { padding: "0.5rem" } });
},

// Tab Shelf
[Tabs.Shelf]() {
    const uuid = state.currentShelfId.get();
    if (!uuid) return tabs.current.set(Tabs.Vault);

    const shelf = vault.storage[uuid];
    if (!shelf) return tabs.current.set(Tabs.Vault);

    const header = this.header("Vault", `Viewing: ${shelf.name}`, [
        tray.flex([this.backButton(), /* bottoni settings/delete */]),
    ]);

    const search = tray.input({
        placeholder: `Search ${shelf.name}...`,
        value: state.shelfSearch.get(),
        style: { borderRadius: "0.5rem", paddingInlineStart: "2.5rem" },
        onChange: ctx.eventHandler("shelf-search-query", (e) => state.shelfSearch.set(String(e.value))),
    });

    // 🔹 Qui manteniamo l'ordine di aggiunta
    const entries = shelf.entries
        .filter((x) =>
            state.shelfSearch.get().length
                ? `${x.title.userPreferred} ${x.title.synonyms.join(" ")}`.toLowerCase().includes(state.shelfSearch.get().toLowerCase())
                : true
        )
        .map((e) => this.formatMediaItem(e, shelf.type, shelf.uuid));

    const body = tray.stack(entries.length ? entries : [this.noEntries()], { style: { display: "flex", gap: "0.25rem", flexWrap: "wrap" } });

    return tray.stack([this.overlay(), header, search, body], { style: { padding: "0.5rem" } });
},

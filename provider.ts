/// <reference path="./plugin.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./core.d.ts" />
/// <reference path="./vault.d.ts" />

//@ts-ignore
function init() {
    $ui.register((ctx) => {
        const iconUrl = "https://raw.githubusercontent.com/nnotwen/n-seanime-extensions/master/plugins/Vault/icon.png";
        const tray = ctx.newTray({ iconUrl, withContent: true });

        enum Tabs {
            Vault = 1,
            Shelf = 2,
            AddToShelf = 3,
        }

        const fieldRef = {
            shelfCreate: {
                name: ctx.fieldRef<string>(""),
                type: ctx.fieldRef<$app.AL_MediaType>("ANIME"),
                reset() {
                    this.name.setValue("");
                    this.type.setValue("ANIME");
                },
            },
            shelfSettings: {
                name: ctx.fieldRef<string>(""),
                importString: ctx.fieldRef<string>(""),
            },
        };

        const state = {
            vaultSearch: ctx.state<string>(""),
            shelfSearch: ctx.state<string>(""),
            currentShelfId: ctx.state<string | null>(null),
            currentMedia: ctx.state<$app.AL_BaseAnime | $app.AL_BaseManga | null>(null),
        };

        const vault = {
            id: "fbefd050-7a20-469f-ade9-12ea803d7149",
            get storage() {
                return ($storage.get(this.id) || {}) as Record<string, Shelf>;
            },
            createShelf(name: string, type: $app.AL_MediaType) {
                const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                    const r = (Math.random() * 16) | 0;
                    const v = c === "x" ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                });

                const storage = this.storage;
                storage[uuid] = { uuid, name, type, entries: [] };
                $storage.set(this.id, storage);
                return storage[uuid];
            },
            editShelfName(uuid: string, name: string) {
                const storage = this.storage;
                const shelf = storage[uuid];
                if (!shelf) throw new Error(`Could not find shelf with uuid ${uuid}`);

                shelf.name = name;
                storage[uuid] = shelf;
                $storage.set(this.id, storage);
                return shelf;
            },
            deleteShelf(uuid: string) {
                const storage = this.storage;
                const deleted = delete storage[uuid];
                $storage.set(this.id, storage);
                return deleted;
            },
            addToShelf(uuid: string, media: $app.AL_BaseAnime | $app.AL_BaseManga) {
                const storage = this.storage;
                const shelf = storage[uuid];
                if (!shelf) throw new Error(`Could not find shelf with uuid ${uuid}!`);
                if (shelf.type !== media.type) throw new Error(`Type mismatch: Cannot upsert media with type ${media.type} to shelf with type ${shelf.type}!`);

                const data: Shelf["entries"][number] = {
                    id: media.id,
                    title: {
                        userPreferred: media.title?.userPreferred!,
                        synonyms: [...(media.synonyms ?? []), ...Object.values(media.title ?? {}).filter(Boolean)],
                    },
                    coverImage: media.coverImage?.large ?? "",
                    season: media.season ?? null,
                    seasonYear: "seasonYear" in media ? media.seasonYear ?? null : null,
                };

                shelf.entries = [...new Map(shelf.entries.map((e) => [e.id, e])).set(data.id, data).values()];
                storage[uuid] = shelf;
                $storage.set(this.id, storage);
                return shelf;
            },
            removeFromShelf(uuid: string, mediaId: number) {
                const storage = this.storage;
                const shelf = storage[uuid];
                if (!shelf) throw new Error(`Could not find shelf with uuid ${uuid}`);

                shelf.entries = shelf.entries.filter((x) => x.id !== mediaId);
                storage[uuid] = shelf;
                $storage.set(this.id, storage);
                return shelf.entries.some((x) => x.id === mediaId);
            },
            import() {
                const array: Shelf[] | undefined = $storage.get("ee67ab39-47e3-4e19-be06-d55ccaf50f36");
                if (!array) return;

                for (const shelf of array) {
                    const { uuid } = this.createShelf(shelf.name, shelf.type);
                    for (const entry of shelf.entries) {
                        this.addToShelf(uuid, {
                            id: entry.id,
                            title: {
                                userPreferred: entry.title.userPreferred,
                            },
                            synonyms: entry.title.synonyms,
                            coverImage: {
                                large: entry.coverImage,
                            },
                            season: entry.season ?? undefined,
                            seasonYear: entry.seasonYear ?? undefined,
                            type: shelf.type,
                        });
                    }
                }

                $storage.remove("ee67ab39-47e3-4e19-be06-d55ccaf50f36");
            },
        };

        const tabs = {
            current: ctx.state<Tabs>(Tabs.Vault),
            currentOverlay: ctx.state<any[] | null>(null),
            overlay() {
                const overlay = this.currentOverlay.get();
                return overlay
                    ? tray.div([
                        tray.flex(overlay, { style: { justifyContent: "center", alignItems: "center", width: "100%", height: "100%" } })
                    ], {
                        className: "fixed bg-black/80 z-[50]",
                        style: {
                            width: "calc(100%)",
                            height: "calc(100% - 1rem)",
                            top: "0%",
                            left: "0%",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border)",
                        },
                    })
                    : ([] as any[]);
            },
            // --- qui continua tutto il resto dei metodi del tab come header, createShelf, importShelf etc ---
            // --- esempio corretto di entries in Vault Tab ---
            [Tabs.Vault]() {
                const header = this.header("Vault", "Create, edit, and view your personal curated list");
                const search = tray.input({
                    placeholder: `Search...`,
                    value: state.vaultSearch.get(),
                    style: { borderRadius: "0.5rem", paddingInlineStart: "2.5rem" },
                    onChange: ctx.eventHandler("search-query", (e) => { state.vaultSearch.set(String(e.value)); }),
                });

                const entries = Object.values(vault.storage)
                    .filter((x) => (
                        state.vaultSearch.get().length
                            ? `${x.name} ${x.entries.map((e) => e.title.synonyms).flat()}`.toLowerCase().includes(state.vaultSearch.get().toLowerCase())
                            : true
                    ))
                    // MODIFICA: rimuovere il sort alfabetico per ordine di aggiunta
                    .map((shelf) => this.formatShelfItem(shelf));

                const body = tray.stack(entries.length ? entries : [this.noEntries()], {
                    style: { height: "25rem", overflowY: "scroll" },
                });

                return tray.stack([this.overlay(), header, search, body], { style: { padding: "0.5rem" } });
            },
        };
    });
}

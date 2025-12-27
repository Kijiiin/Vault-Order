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
        storage[uuid] = { uuid, name, type, entries: [], createdAt: Date.now() };
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
          addedAt: Date.now(),
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
    };

    const formatVaultEntries = () => {
      const entries = Object.values(vault.storage)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        .filter((x) =>
          state.vaultSearch.get().length
            ? `${x.name} ${x.entries.map((e) => e.title.synonyms).flat()}`.toLowerCase().includes(state.vaultSearch.get().toLowerCase())
            : true
        )
        .map((shelf) => {
          const covers = shelf.entries.map((x) => x.coverImage).filter(Boolean);
          const background = tray.div([], {
            style: {
              height: "100%",
              width: "100%",
              maxWidth: "15rem",
              backgroundImage: covers.length ? `url(${covers[Math.floor(Math.random() * covers.length)]})` : "",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              maskImage: covers.length ? "linear-gradient(to left, rgba(0,0,0,0.7) 0%, transparent 100%)" : "none",
            },
          });
          const content = tray.stack(
            [
              tray.text(`${shelf.name}`, { className: "font-semibold" }),
              tray.text(`${shelf.entries.length} ${shelf.entries.length === 1 ? "entry" : "entries"}`, { style: { fontSize: "0.7rem", opacity: 0.7 } }),
            ],
            { style: { justifyContent: "space-between", padding: "0.75rem", minHeight: "6rem", position: "relative" } }
          );
          const button = tray.button("\u200b", {
            style: { position: "absolute", width: "100%", height: "100%", top: "0", background: "none" },
            onClick: ctx.eventHandler(`vault-clicked:${shelf.uuid}`, () => {
              state.currentShelfId.set(shelf.uuid);
              tabs.current.set(Tabs.Shelf);
            }),
          });
          return tray.div([background, content, button], { className: "vault-shelf-entry-card-container bg-gray-900", style: { position: "relative", borderRadius: "0.5rem", border: "1px solid var(--border)", minHeight: "fit-content", overflow: "hidden" } });
        });
      return entries.length ? entries : [tray.text("No entries", { style: { textAlign: "center", width: "100%", padding: "2rem", opacity: 0.7 } })];
    };

    const tabs = {
      current: ctx.state<Tabs>(Tabs.Vault),
    };

    return {
      [Tabs.Vault]() {
        const header = tray.text("Vault", { className: "font-semibold" });
        const search = tray.input({
          placeholder: `Search...`,
          value: state.vaultSearch.get(),
          onChange: ctx.eventHandler("search-query", (e) => state.vaultSearch.set(String(e.value))),
        });
        const body = tray.stack(formatVaultEntries(), { style: { height: "25rem", overflowY: "scroll" } });
        return tray.stack([header, search, body], { style: { padding: "0.5rem" } });
      },
      [Tabs.Shelf]() {
        const shelf = state.currentShelfId.get() ? vault.storage[state.currentShelfId.get()!] : null;
        if (!shelf) return tray.text("Shelf not found", { style: { padding: "2rem", textAlign: "center" } });

        const entries = shelf.entries
          .sort((a, b) => a.addedAt - b.addedAt)
          .map((media) =>
            tray.stack(
              [
                tray.text(media.title.userPreferred),
                tray.button("Remove", {
                  onClick: () => {
                    vault.removeFromShelf(shelf.uuid, media.id);
                    ctx.refresh();
                  },
                }),
              ],
              { style: { justifyContent: "space-between", padding: "0.5rem", borderBottom: "1px solid var(--border)" } }
            )
          );

        const content = entries.length ? tray.stack(entries, { style: { overflowY: "scroll", maxHeight: "25rem" } }) : tray.text("No entries", { style: { padding: "2rem", textAlign: "center", opacity: 0.7 } });
        return tray.stack([tray.text(shelf.name, { className: "font-semibold" }), content], { style: { padding: "0.5rem" } });
      },
    };
  });
}

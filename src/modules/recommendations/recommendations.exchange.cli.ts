interface SyntheticEvent {
    id: string;
    user_id: string;
    album_id: string;
    rating: number | null;
    occurred_at: string;
    observed_at: string;
    source: "synthetic";
}

export function createSyntheticExchange() {
    const albums = Array.from({ length: 13 }, (_, index) => ({
        id: `synthetic-album-${String(index + 1).padStart(2, "0")}`,
        available_at: index === 12 ? "2026-01-06T00:00:00Z" : "2026-01-01T00:00:00Z",
        source: "synthetic" as const,
    }));
    const events: SyntheticEvent[] = [];
    for (let user = 0; user < 12; user += 1) {
        const family = Math.floor(user / 4) * 4;
        for (let position = 0; position < 4; position += 1) {
            const album = family + ((user % 4 + position) % 4);
            const timestamp = `2026-01-${String([1, 2, 4, 6][position]).padStart(2, "0")}T12:00:00Z`;
            events.push({
                id: `event-${String(user).padStart(2, "0")}-${position}`,
                user_id: `synthetic-user-${String(user + 1).padStart(2, "0")}`,
                album_id: albums[album].id,
                rating: 5,
                occurred_at: timestamp,
                observed_at: timestamp,
                source: "synthetic",
            });
        }
    }
    events.push({
        id: "cold", user_id: "synthetic-user-13", album_id: albums[12].id, rating: 5,
        occurred_at: "2026-01-06T12:00:00Z", observed_at: "2026-01-06T12:00:00Z", source: "synthetic",
    });
    return {
        schemaVersion: 1,
        mode: "synthetic",
        origin: "mycdrecords-internal-fixture-v1",
        cuts: ["2026-01-03T00:00:00Z", "2026-01-05T00:00:00Z", "2026-01-07T00:00:00Z"],
        albums,
        events,
    };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0] !== "--synthetic") {
        console.error("Uso: npm run ml:export:rehearsal -- --synthetic. Somente fixture interna, sem importacao ou dados reais.");
        process.exitCode = 2;
    } else {
        console.log(JSON.stringify(createSyntheticExchange()));
    }
}

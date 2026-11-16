import request from "supertest";
import { readFile } from "node:fs/promises";
import { createRecommendationLabApp } from "../../modules/recommendations/recommendations.lab";

jest.mock("node:fs/promises", () => ({ readFile: jest.fn() }));
const read = jest.mocked(readFile);

function snapshot() {
    const album = (index: number) => `synthetic-album-${String(index + 1).padStart(2, "0")}`;
    return {
        schemaVersion: 1, mode: "synthetic", modelVersion: "pytorch-bpr-v1", datasetVersion: "synthetic-families-v1",
        snapshotId: "a".repeat(64), generatedAt: "2026-11-16T12:00:00.000Z",
        promotionAllowed: false, realWorldQuality: "not_measured",
        training: { initialLoss: 0.7, finalLoss: 0.1, epochs: 200, seed: 42, torchVersion: "2.15.0+cpu" },
        evaluation: { protocol: "synthetic-leave-one-out", k: 3, model: { recall: 1, ndcg: 1 }, baseline: { recall: 1, ndcg: 1 } },
        profiles: Array.from({ length: 12 }, (_, user) => {
            const trainingAlbums = Array.from({ length: 4 }, (_, n) => album(Math.floor(user / 4) * 4 + n)).filter((id) => id !== album(user));
            const candidates = Array.from({ length: 12 }, (_, n) => album(n)).filter((id) => !trainingAlbums.includes(id) && id !== album(user));
            const ranked = [album(user), ...candidates].slice(0, 6).map((albumId, n) => ({ albumId, score: 6 - n }));
            return { id: `synthetic-user-${String(user + 1).padStart(2, "0")}`, trainingAlbums, heldOutAlbum: album(user), recommendations: ranked, baseline: ranked };
        }),
    };
}

beforeEach(() => {
    read.mockReset();
    read.mockResolvedValue(JSON.stringify(snapshot()));
});

describe("isolated synthetic recommendation lab", () => {
    it("serves the saved snapshot anonymously, without SQL or cookies, and never caches it", async () => {
        const res = await request(createRecommendationLabApp("synthetic-snapshot.json")).get("/api/recommendations/lab");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(snapshot());
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.headers["set-cookie"]).toBeUndefined();
        expect(read).toHaveBeenCalledWith("synthetic-snapshot.json", "utf8");
    });

    it("returns an explicit missing-training state, never a successful empty fallback", async () => {
        read.mockRejectedValue(Object.assign(new Error("Missing fixture"), { code: "ENOENT" }));
        const res = await request(createRecommendationLabApp()).get("/api/recommendations/lab");
        expect(res.status).toBe(503);
        expect(res.body.code).toBe("ML_LAB_NOT_TRAINED");
    });

    it.each(["not-json", JSON.stringify({ ...snapshot(), mode: "spotify" }), JSON.stringify({ ...snapshot(), promotionAllowed: true }), " ".repeat(131073)])("rejects malformed or ineligible snapshots", async (content) => {
        read.mockResolvedValue(content);
        const res = await request(createRecommendationLabApp()).get("/api/recommendations/lab");
        expect(res.status).toBe(503);
        expect(res.body.code).toBe("ML_LAB_INVALID_SNAPSHOT");
        expect(res.body).not.toHaveProperty("profiles");
    });

    it("rejects a partial snapshot, duplicate profiles, repeated/seen albums and unsorted scores", async () => {
        const invalid = [
            { ...snapshot(), profiles: snapshot().profiles.slice(0, 1) },
            { ...snapshot(), profiles: Array.from({ length: 12 }, () => snapshot().profiles[0]) },
        ];
        for (const change of ["seen", "duplicate", "unsorted"]) {
            const data = snapshot();
            const items = data.profiles[0].recommendations;
            if (change === "seen") items[0].albumId = data.profiles[0].trainingAlbums[0];
            if (change === "duplicate") items[1].albumId = items[0].albumId;
            if (change === "unsorted") items[1].score = 999;
            invalid.push(data);
        }
        for (const data of invalid) {
            read.mockResolvedValue(JSON.stringify(data));
            expect((await request(createRecommendationLabApp()).get("/api/recommendations/lab")).status).toBe(503);
        }
    });

    it("does not swallow other filesystem failures", async () => {
        read.mockRejectedValue(Object.assign(new Error("Fixture read denied"), { code: "EACCES" }));
        const res = await request(createRecommendationLabApp()).get("/api/recommendations/lab");
        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Fixture read denied");
    });

    it("refuses serving in production even if a snapshot exists", async () => {
        const previous = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = "production";
            const res = await request(createRecommendationLabApp()).get("/api/recommendations/lab");
            expect(res.status).toBe(404);
            expect(read).not.toHaveBeenCalled();
        } finally {
            process.env.NODE_ENV = previous;
        }
    });
});

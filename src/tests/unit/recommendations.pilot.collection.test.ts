import { inspectPilotCollection, markPilotRetentionHealthy, markPilotStorageReady, pilotNotice } from "../../modules/recommendations/recommendations.pilot.collection";

beforeEach(() => {
    markPilotStorageReady(false);
    markPilotRetentionHealthy(false);
});

it("never enables collection from a flag alone or a stale/draft acknowledgement", () => {
    markPilotStorageReady(true);
    markPilotRetentionHealthy(true);
    for (const version of [undefined, "ml-pilot-draft-v1", "public-reviews-v1"]) {
        expect(inspectPilotCollection({
            ML_PILOT_COLLECTION_ENABLED: "true", ML_PILOT_NOTICE_APPROVED_VERSION: version,
            ML_PILOT_DURABLE_RETENTION_CONFIRMED: "true",
        }).collectionAllowed).toBe(false);
    }
});

it("requires initialized storage, working retention and the exact public notice approval", () => {
    const env = {
        ML_PILOT_COLLECTION_ENABLED: "true", ML_PILOT_NOTICE_APPROVED_VERSION: pilotNotice.version,
        ML_PILOT_DURABLE_RETENTION_CONFIRMED: "true",
    };
    expect(inspectPilotCollection(env).collectionAllowed).toBe(false);
    markPilotStorageReady(true);
    expect(inspectPilotCollection(env).collectionAllowed).toBe(false);
    markPilotRetentionHealthy(true);
    expect(inspectPilotCollection(env).collectionAllowed).toBe(true);
    markPilotRetentionHealthy(false);
    expect(inspectPilotCollection(env).collectionAllowed).toBe(false);
});

it("rejects malformed configuration instead of treating it as permission", () => {
    expect(() => inspectPilotCollection({ ML_PILOT_COLLECTION_ENABLED: "yes" })).toThrow();
});

it("does not mistake the process-local timer for confirmed durable retention", () => {
    markPilotStorageReady(true);
    markPilotRetentionHealthy(true);
    const state = inspectPilotCollection({
        ML_PILOT_COLLECTION_ENABLED: "true", ML_PILOT_NOTICE_APPROVED_VERSION: pilotNotice.version,
    });
    expect(state.collectionAllowed).toBe(false);
    expect(state.blockers).toContain("DURABLE_RETENTION_NOT_CONFIRMED");
});

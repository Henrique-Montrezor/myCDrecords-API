jest.mock("../../modules/recommendations/recommendations.pilot.controls", () => ({
    purgeExpiredPilotEvents: jest.fn(),
}));
import { purgeExpiredPilotEvents } from "../../modules/recommendations/recommendations.pilot.controls";
import { inspectPilotCollection, markPilotRetentionHealthy, markPilotStorageReady, pilotNotice } from "../../modules/recommendations/recommendations.pilot.collection";
import { startPilotRetention } from "../../modules/recommendations/recommendations.pilot.retention";

const env = { ...process.env };
afterEach(() => {
    jest.useRealTimers();
    process.env = { ...env };
    markPilotStorageReady(false);
    markPilotRetentionHealthy(false);
});

it("cleans before allowing collection and blocks collection after retention failure until recovery", async () => {
    jest.useFakeTimers();
    process.env.ML_PILOT_COLLECTION_ENABLED = "true";
    process.env.ML_PILOT_NOTICE_APPROVED_VERSION = pilotNotice.version;
    process.env.ML_PILOT_DURABLE_RETENTION_CONFIRMED = "true";
    jest.mocked(purgeExpiredPilotEvents).mockResolvedValue({ purgedEvents: 0, purgedReceipts: 0 });
    const stop = await startPilotRetention();
    expect(inspectPilotCollection().collectionAllowed).toBe(true);
    jest.mocked(purgeExpiredPilotEvents).mockRejectedValueOnce(new Error("Synthetic retention failure."));
    await jest.advanceTimersByTimeAsync(60_000);
    expect(inspectPilotCollection().collectionAllowed).toBe(false);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(inspectPilotCollection().collectionAllowed).toBe(true);
    stop();
    expect(jest.getTimerCount()).toBe(0);
});

it("does not enable collection or start a timer when initial cleanup fails", async () => {
    jest.useFakeTimers();
    markPilotRetentionHealthy(false);
    jest.mocked(purgeExpiredPilotEvents).mockRejectedValueOnce(new Error("Synthetic startup failure."));
    await expect(startPilotRetention()).rejects.toThrow("Synthetic startup failure.");
    expect(inspectPilotCollection().collectionAllowed).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});

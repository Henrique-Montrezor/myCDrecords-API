import { logger } from "../../utils/logger";
import { purgeExpiredPilotEvents } from "./recommendations.pilot.controls";
import { markPilotRetentionHealthy, markPilotStorageReady } from "./recommendations.pilot.collection";

export async function startPilotRetention() {
    markPilotStorageReady(true);
    await purgeExpiredPilotEvents();
    markPilotRetentionHealthy(true);
    let running = false;
    const timer = setInterval(async () => {
        if (running) return;
        running = true;
        markPilotRetentionHealthy(false);
        try {
            await purgeExpiredPilotEvents();
            markPilotRetentionHealthy(true);
        } catch (error) {
            logger.error("ML pilot retention failed; collection remains blocked", { error });
        } finally {
            running = false;
        }
    }, 60_000);
    timer.unref();
    return () => clearInterval(timer);
}

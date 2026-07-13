import { countUserReviews, awardEligibleBadges } from "./gamification.repository";
import { logger } from "../../utils/logger";

/**
 * Evaluates and grants badges to the user based on the number of reviews.
 * Should be called after the user publishes a review. Does not throw an error
 * to avoid interrupting the main flow — it only logs failures.
 */
export async function evaluateUserBadges(userId: number): Promise<number> {
    try {
        const reviewCount = await countUserReviews(userId);
        return await awardEligibleBadges(userId, reviewCount);
    } catch (error) {
        logger.error("Error evaluating user badges", { error });
        return 0;
    }
}

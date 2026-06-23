import { countUserReviews, awardEligibleBadges } from "./gamification.repository";

/**
 * Avalia e concede emblemas ao usuário com base na quantidade de avaliações.
 * Deve ser chamada após o usuário publicar uma avaliação. Não lança erro para
 * não interromper o fluxo principal — apenas registra falhas no log.
 */
export async function evaluateUserBadges(userId: number): Promise<number> {
    try {
        const reviewCount = await countUserReviews(userId);
        return await awardEligibleBadges(userId, reviewCount);
    } catch (error) {
        console.error("Erro ao avaliar emblemas do usuário:", error);
        return 0;
    }
}

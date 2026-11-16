import { z } from "zod";

const planSchema = z.object({
    ownerRole: z.string().trim().min(1).max(200),
    purpose: z.literal("internal-album-recommendation-evaluation"),
    cohort: z.literal("internal-opt-in"),
    signals: z.tuple([z.literal("prospective-independent-ratings")]),
    retentionDays: z.literal(30),
    withdrawal: z.literal("block-and-invalidate-derived"),
    legalBasis: z.string().trim().min(1).max(1000).nullable(),
    privacyPolicy: z.object({
        reference: z.string().trim().min(1).max(1000),
        version: z.string().trim().min(1).max(100),
        reviewedAt: z.string().datetime({ offset: true }),
    }).strict().nullable(),
}).strict();

export const pilotPlan: z.infer<typeof planSchema> = {
    ownerRole: "Administradores - MyCDRecords",
    purpose: "internal-album-recommendation-evaluation",
    cohort: "internal-opt-in",
    signals: ["prospective-independent-ratings"],
    retentionDays: 30,
    withdrawal: "block-and-invalidate-derived",
    legalBasis: "Consentimento específico, opcional e revogável para o piloto interno, declarado pelo responsável. Não constitui parecer jurídico.",
    privacyPolicy: null,
};

export function inspectPilotPlan(input: unknown) {
    const plan = planSchema.parse(input);
    const blockers: string[] = [];
    if (plan.legalBasis === null) blockers.push("LEGAL_BASIS_PENDING");
    // Private policy references need not be shared. This static preflight covers persisted models/serving only.
    blockers.push(
        "PILOT_MYSQL_HOMOLOGATION_NOT_RECORDED",
        "PROVENANCE_NOT_VERIFIED",
        "DERIVED_DELETION_RETENTION_NOT_IMPLEMENTED",
        "PERSISTENT_MODEL_LIFECYCLE_NOT_IMPLEMENTED",
        "REAL_MODEL_PROMOTION_DISABLED",
    );
    return {
        schemaVersion: 1,
        mode: "preflight" as const,
        scope: "persisted-real-models-and-serving" as const,
        plan,
        declarationsOnly: true,
        policyReferenceShared: plan.privacyPolicy !== null,
        realDataAllowed: false,
        promotionAllowed: false,
        blockers,
    };
}

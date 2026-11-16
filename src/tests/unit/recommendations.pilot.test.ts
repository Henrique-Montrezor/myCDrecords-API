import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { inspectPilotPlan, pilotPlan } from "../../modules/recommendations/recommendations.pilot";

describe("real-data pilot preflight", () => {
    it("does not promote persistent models from owner declarations alone", () => {
        const report = inspectPilotPlan({ ...pilotPlan, legalBasis: null });
        expect(report.realDataAllowed).toBe(false);
        expect(report.promotionAllowed).toBe(false);
        expect(report.blockers).toEqual(expect.arrayContaining([
            "LEGAL_BASIS_PENDING",
            "PILOT_MYSQL_HOMOLOGATION_NOT_RECORDED",
            "PROVENANCE_NOT_VERIFIED", "DERIVED_DELETION_RETENTION_NOT_IMPLEMENTED",
            "PERSISTENT_MODEL_LIFECYCLE_NOT_IMPLEMENTED",
        ]));
    });

    it("never requires disclosure of the confidential policy for the separate local-memory experiment", () => {
        const report = inspectPilotPlan(pilotPlan);
        expect(report.scope).toBe("persisted-real-models-and-serving");
        expect(report.policyReferenceShared).toBe(false);
        expect(report.blockers).not.toContain("PRIVACY_POLICY_REFERENCE_MISSING");
    });

    it("does not mistake declared governance for operational readiness", () => {
        const report = inspectPilotPlan({
            ...pilotPlan,
            legalBasis: "Synthetic policy declaration, not a legal opinion",
            privacyPolicy: { reference: "https://example.invalid/privacy", version: "fixture-v1", reviewedAt: "2026-11-16T12:00:00Z" },
        });
        expect(report.blockers).not.toContain("LEGAL_BASIS_PENDING");
        expect(report.blockers).not.toContain("PRIVACY_POLICY_REFERENCE_MISSING");
        expect(report.blockers).toContain("DERIVED_DELETION_RETENTION_NOT_IMPLEMENTED");
        expect(report.realDataAllowed).toBe(false);
    });

    it.each([
        { retentionDays: 0 }, { retentionDays: 90 }, { legalBasis: "" },
        { privacyPolicy: { reference: "", version: "", reviewedAt: "invalid" } },
        { includeReviewText: true }, { realDataAllowed: true }, { cohort: "all-users" },
    ])("rejects unapproved changes or attempts to bypass the gate: %j", (change) => {
        expect(() => inspectPilotPlan({ ...pilotPlan, ...change })).toThrow();
    });
});

describe("pilot CLI isolation", () => {
    const cwd = resolve(__dirname, "../../..");
    const run = (file: string, args: string[]) => spawnSync(process.execPath, [
        "-r", "ts-node/register", resolve(cwd, `src/modules/recommendations/${file}.cli.ts`), ...args,
    ], { cwd, encoding: "utf8", timeout: 30000 });

    it("returns a machine-readable blocked preflight and nonzero exit status", () => {
        const result = run("recommendations.pilot", []);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");
        expect(JSON.parse(result.stdout)).toEqual(inspectPilotPlan(pilotPlan));
    });

    it("exports only internal synthetic events with explicit opt-in", () => {
        const result = run("recommendations.exchange", ["--synthetic"]);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        const exchange = JSON.parse(result.stdout);
        expect(exchange.mode).toBe("synthetic");
        expect(exchange.events.some((event: { user_id: string }) => event.user_id === "synthetic-user-13")).toBe(true);
        expect(result.stdout).not.toMatch(/"(text|email|username|token|image|tags|accountId|reviewId)"/);
    });

    it.each([
        ["recommendations.exchange", []],
        ["recommendations.exchange", ["--real"]],
        ["recommendations.exchange", ["--synthetic", "--input", "users.json"]],
        ["recommendations.pilot", ["--enable"]],
    ] as const)("rejects unsupported arguments for %s", (file, args) => {
        const result = run(file, [...args]);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(2);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Uso:");
    });
});

jest.mock("../../mysql2/init.database", () => ({
    initDatabase: jest.fn(async () => ({ query: mockQuery })),
}));

import { createUser } from "../../modules/users/user.repository";
import { migratePublicReviewNotice } from "../../mysql2/migrations/007-public-review-notice";

const mockQuery = jest.fn();
const account = { username: "synthetic-user", email: "fixture@example.invalid", password: "synthetic-hash", is_active: true };

beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ insertId: 7 }, []]);
});

it("inserts the account and versioned acknowledgement together using the database clock", async () => {
    await expect(createUser({ ...account, publicReviewNoticeVersion: "public-reviews-v1" })).resolves.toMatchObject({ id: 7 });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO users");
    expect(sql).toContain("public_review_notice_version");
    expect(sql).toContain("public_review_notice_accepted_at");
    expect(sql).toContain("UTC_TIMESTAMP(3)");
    expect(values).toEqual([account.username, account.email, account.password, true, "public-reviews-v1", "public-reviews-v1"]);
});

it("does not invent acknowledgement for a legacy account creation path", async () => {
    await createUser(account);
    expect(mockQuery.mock.calls[0][1].slice(-2)).toEqual([null, null]);
    expect(mockQuery.mock.calls[0][0]).toContain("IF(? IS NULL, NULL, UTC_TIMESTAMP(3))");
});

it("does not return successful registration if the atomic insert fails", async () => {
    const failure = new Error("Synthetic insert failure");
    mockQuery.mockRejectedValueOnce(failure);
    await expect(createUser({ ...account, publicReviewNoticeVersion: "public-reviews-v1" })).rejects.toBe(failure);
});

it("resumes a partial migration without backfilling acknowledgement or modifying existing columns", async () => {
    mockQuery
        .mockResolvedValueOnce([[{ COLUMN_NAME: "public_review_notice_version" }], []])
        .mockResolvedValueOnce([[], []]);
    await migratePublicReviewNotice({ query: mockQuery });
    const statements = mockQuery.mock.calls.map(([sql]) => sql);
    expect(statements.filter((sql) => sql.includes("ALTER TABLE"))).toEqual([
        expect.stringContaining("public_review_notice_accepted_at DATETIME(3) NULL"),
    ]);
    expect(statements.join("\n")).not.toMatch(/UPDATE users|DROP |NOT NULL/);
    mockQuery.mockReset().mockResolvedValue([[{ COLUMN_NAME: "exists" }], []]);
    await migratePublicReviewNotice({ query: mockQuery });
    expect(mockQuery.mock.calls.every(([sql]) => !sql.includes("ALTER TABLE"))).toBe(true);
});

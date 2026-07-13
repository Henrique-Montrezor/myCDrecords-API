import { z } from "zod";

export const userIdParamSchema = z.object({
    userId: z.coerce
        .number({ invalid_type_error: "Invalid userId" })
        .int("Invalid userId")
        .positive("Invalid userId"),
});

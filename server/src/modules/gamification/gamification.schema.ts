import { z } from "zod";

export const userIdParamSchema = z.object({
    userId: z.coerce
        .number({ invalid_type_error: "userId inválido" })
        .int("userId inválido")
        .positive("userId inválido"),
});

import { swaggerSpec } from "../../docs/swagger";

it("publishes the binary image and revisioned move contracts with optional public read authentication", () => {
    const imagePath = "/api/lists/{listId}/images/{kind}";
    expect(swaggerSpec).toHaveProperty(["paths", imagePath, "get", "responses", "200", "content", "image/jpeg"]);
    expect(swaggerSpec).toHaveProperty(["paths", imagePath, "get", "security"], [{}, { BearerAuth: [] }]);
    expect(swaggerSpec).toHaveProperty(["paths", imagePath, "put", "requestBody", "content", "image/png"]);
    expect(swaggerSpec).toHaveProperty(["paths", imagePath, "delete", "responses", "204"]);
    expect(swaggerSpec).toHaveProperty(["paths", "/api/lists/{listId}/order", "put", "responses", "409"]);
    expect(swaggerSpec).toHaveProperty(["paths", "/api/lists/{listId}", "get", "security"], [{}, { BearerAuth: [] }]);
});

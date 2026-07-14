import swaggerJsdoc from "swagger-jsdoc";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3004;
const URL = process.env.DOMAIN || `http://localhost:${PORT}`;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MyCDRecords API",
      version: "0.0.1",
      description: "Social network for music lovers",
    },
    servers: [
      {
        url: URL,
        description: "Local Server"
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { // bearerAuth is the name of the security scheme
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  // The path below instructs swagger-jsdoc to read all .ts files within src/modules/
  apis: ["./src/modules/**/*.ts", "./src/modules/**/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
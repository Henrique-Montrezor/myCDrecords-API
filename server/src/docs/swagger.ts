import swaggerJsdoc from "swagger-jsdoc";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3004;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MyCDRecords API",
      version: "0.0.1",
      description: "API para buscar artistas, álbuns e músicas via MusicBrainz",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Servidor Local"
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { // Foi definido como BearerAuth nas suas rotas
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
  // O caminho abaixo instrui o swagger-jsdoc a ler todos os ficheiros .ts dentro de src/modules/
  apis: ["./src/modules/**/*.ts", "./src/modules/**/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
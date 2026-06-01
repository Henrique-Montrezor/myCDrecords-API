import swaggerJSDoc from "swagger-jsdoc";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;


export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MyCDRecords API",
      version: "0.0.1",
      description: "API para buscar artistas, álbuns e músicas via MusicBrainz"
    },
    servers: [
      {
        url: `http://localhost:${PORT}`
      }
    ]
  },
  apis: ["./src/modules/**/*.routes.ts"] // 👈 importante
});
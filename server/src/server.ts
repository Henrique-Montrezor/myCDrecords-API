import app from "./app";
import dotenv from 'dotenv'

dotenv.config();

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📚 Docs em http://localhost:${PORT}/docs`);
});
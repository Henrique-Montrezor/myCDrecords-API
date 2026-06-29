// Variáveis de ambiente determinísticas para os testes.
// Garante que a assinatura/verificação de JWT use segredos conhecidos e
// evita conexões reais com Redis (sem REDIS_URL o rate limiter usa memória).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_RESET_SECRET = "test-reset-secret";
process.env.JWT_VERIFY_SECRET = "test-verify-secret";
delete process.env.REDIS_URL;

// Silencia os logs de inicialização do app (dotenv, swagger-jsdoc, aviso do
// Redis e "Database initialization complete") que poluem a saída dos testes.
// Defina TEST_VERBOSE=1 para ver toda a saída ao depurar.
if (!process.env.TEST_VERBOSE) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

// environment variables for tests
// Ensures JWT signing/verification uses known secrets and
// avoids real Redis connections (without REDIS_URL the rate limiter uses memory).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_RESET_SECRET = "test-reset-secret";
process.env.JWT_VERIFY_SECRET = "test-verify-secret";
delete process.env.REDIS_URL;
delete process.env.ML_PILOT_COLLECTION_ENABLED;
delete process.env.ML_PILOT_NOTICE_APPROVED_VERSION;
delete process.env.ML_PILOT_DURABLE_RETENTION_CONFIRMED;

// App/bootstrap tests must not load local credentials or enable collection from .env.
jest.mock("dotenv", () => ({ config: jest.fn(() => ({ parsed: {} })) }));

// Silences app initialization logs (dotenv, swagger-jsdoc, Redis warning, and "Database initialization complete") that clutter test output.
// Set TEST_VERBOSE=1 to see full output when debugging.
if (!process.env.TEST_VERBOSE) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

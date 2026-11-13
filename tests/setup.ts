import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Tests always run against the dedicated test database and a throwaway storage dir.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://keepsake:keepsake_dev@localhost:5432/keepsake_test";
process.env.STORAGE_DRIVER = "local";
process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "keepsake-test-"));
process.env.STORAGE_SIGNING_SECRET = "test-signing-secret-test-signing-secret";
process.env.APP_URL = "http://localhost:3000";

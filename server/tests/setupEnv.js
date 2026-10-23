import os from 'node:os';
import path from 'node:path';
import { inject } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `${inject('mongoUri')}socio-test`;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-123';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-456';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'socio-test-uploads');
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.PUBLIC_SERVER_URL = 'http://localhost:4000';

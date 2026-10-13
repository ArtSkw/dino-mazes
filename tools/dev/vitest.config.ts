import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tools/dev/**/*.test.ts'], environment: 'node' } });

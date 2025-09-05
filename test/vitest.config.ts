import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['tests/**/*.test.tsx'],
	},
	resolve: {
		alias: {
			'react-tree-stream': path.resolve(__dirname, '../package/src/index.tsx'),
		},
	},
});

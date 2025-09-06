import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.tsx'],
	format: ['esm', 'cjs'],
	sourcemap: true,
	minify: false,
	clean: true,
	dts: true,
});

import { TextEncoder, TextDecoder } from 'util';

// jsdom polyfills
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder as any;

// Tell React that this environment supports act()
// This silences warnings and ensures timers-driven updates are treated as part of tests
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// requestAnimationFrame polyfill used by React 18 in some code paths
if (!(globalThis as any).requestAnimationFrame) {
	(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
		setTimeout(() => cb(performance.now()), 16);
}
if (!(globalThis as any).cancelAnimationFrame) {
	(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

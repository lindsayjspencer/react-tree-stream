import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { TreeStream } from 'react-tree-stream';

function render(ui: React.ReactElement) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(ui);
	});
	return { container, root, unmount: () => root.unmount() };
}

describe('useSequentialScheduler integration', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});
	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('cancels prior run timers when signature changes', async () => {
		const App = ({ msg }: { msg: string }) => (
			<TreeStream interval={100} speed={1} streamBy="character">
				{msg}
			</TreeStream>
		);
		const { container, root } = render(<App msg="Hello" />);
		const host = container.querySelector('[data-tree-stream]') as HTMLElement;

		// Advance one tick, then change props to trigger reset; prior timers should not continue
		await act(async () => {
			vi.advanceTimersByTime(100);
		});
		expect(host.textContent).toBe('H');

		await act(async () => {
			root.render(<App msg="World" />);
		});

		await act(async () => {
			vi.advanceTimersByTime(100);
		});
		// Should start from new message, not continue from old
		expect(host.textContent).toBe('W');
	});
});

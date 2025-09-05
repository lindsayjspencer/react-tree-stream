import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { memo, forwardRef } from 'react';
import { TreeStream } from 'react-tree-stream';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

function render(ui: React.ReactElement) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(ui);
	});
	return { container, root, unmount: () => root.unmount() };
}

function compact(text: string | null | undefined) {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function runUntilComplete(host: HTMLElement, maxMs = 5000, step = 10) {
	let elapsed = 0;
	while (host.dataset.complete !== 'true' && elapsed <= maxMs) {
		await act(async () => {
			vi.advanceTimersByTime(step);
		});
		elapsed += step;
	}
}

describe('TreeStream', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});
	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('exports the component', () => {
		expect(TreeStream).toBeTypeOf('function');
	});

	it('streams words/whitespace blocks over time', async () => {
		const { container } = render(
			<TreeStream speed={2} interval={10}>
				Hello world!
			</TreeStream>,
		);

		const host = container.querySelector('[data-tree-stream]') as HTMLElement | null;
		expect(host).toBeTruthy();
		expect(compact(host!.textContent)).toBe('');
		expect(host!.dataset.streaming).toBe('true');
		expect(host!.dataset.complete).toBe('false');

		await act(async () => {
			vi.advanceTimersByTime(10);
		});
		// First two tokens: "Hello" + following space
		expect(host!.textContent).toBe('Hello ');

		await act(async () => {
			vi.advanceTimersByTime(10);
		});
		expect(host!.textContent).toBe('Hello world!');
		expect(host!.dataset.streaming).toBe('false');
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(host!.dataset.complete).toBe('true');
	});

	it('streams characters when streamBy="character"', async () => {
		const { container } = render(
			<TreeStream streamBy="character" speed={1} interval={10}>
				Hi!
			</TreeStream>,
		);

		const host = container.querySelector('[data-tree-stream]') as HTMLElement;
		expect(host).toBeTruthy();
		expect(compact(host.textContent)).toBe('');
		expect(host.dataset.streaming).toBe('true');
		expect(host.dataset.complete).toBe('false');

		await act(async () => {
			vi.advanceTimersByTime(10);
		});
		expect(host.textContent).toBe('H');

		await act(async () => {
			vi.advanceTimersByTime(10);
		});
		expect(host.textContent).toBe('Hi');

		await act(async () => {
			vi.advanceTimersByTime(10);
		});
		expect(host.textContent).toBe('Hi!');

		expect(host.dataset.streaming).toBe('false');
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(host.dataset.complete).toBe('true');
	});

	it('renders non-streamed elements instantly', async () => {
		const { container } = render(
			<TreeStream interval={1000}>
				<strong>Bold</strong>
				and text
			</TreeStream>,
		);

		const host = container.querySelector('[data-tree-stream]') as HTMLElement;
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(host.innerHTML).toContain('<strong>Bold</strong>');
		await act(async () => {
			vi.advanceTimersByTime(5000);
			vi.advanceTimersByTime(0);
		});
		expect(compact(host.textContent)).toContain('Bold');
		expect(compact(host.textContent)).toContain('and text');
	});

	it('supports nested streams and waits for child completion', async () => {
		const { container } = render(
			<TreeStream interval={5} speed={10}>
				{'Parent start '}
				<TreeStream interval={5} speed={10}>
					Child text
				</TreeStream>
				{' Parent end'}
			</TreeStream>,
		);

		const host = container.querySelector('[data-tree-stream]') as HTMLElement;
		await runUntilComplete(host, 5000, 10);
		expect(compact(host.textContent)).toBe('Parent start Child text Parent end');
		expect(host.dataset.complete).toBe('true');
	});

	it('respects autoStart=false until started by prop change', async () => {
		const App = ({ autoStart }: { autoStart: boolean }) => (
			<TreeStream interval={5} speed={10} autoStart={autoStart}>
				Wait for start
			</TreeStream>
		);
		const { container, root } = render(<App autoStart={false} />);
		const host = container.querySelector('[data-tree-stream]') as HTMLElement;
		expect(compact(host.textContent)).toBe('');
		expect(host.dataset.complete).toBe('false');

		await act(async () => {
			root.render(<App autoStart />);
		});
		await act(async () => {
			vi.advanceTimersByTime(1000);
		});
		expect(compact(host.textContent)).toBe('Wait for start');
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(host.dataset.complete).toBe('true');
	});

	it('calls onComplete when the stream finishes', async () => {
		const onComplete = vi.fn();
		const { root } = render(
			<TreeStream interval={5} speed={10} onComplete={onComplete}>
				Done soon
			</TreeStream>,
		);
		expect(onComplete).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(1000);
		});
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(onComplete).toHaveBeenCalledTimes(1);
		root.unmount();
	});

	it('exposes data attributes for streaming and completion', async () => {
		const { container } = render(
			<TreeStream interval={50} speed={1}>
				abc
			</TreeStream>,
		);
		const host = container.querySelector('[data-tree-stream]') as HTMLElement;
		expect(host.dataset.streaming).toBe('true');
		expect(host.dataset.complete).toBe('false');
		await act(async () => {
			vi.advanceTimersByTime(5000);
		});
		expect(host.dataset.streaming).toBe('false');
		await act(async () => {
			vi.advanceTimersByTime(0);
		});
		expect(host.dataset.complete).toBe('true');
	});

	it('detects nested streams through memo and forwardRef wrappers', async () => {
		const MemoTreeStream = memo(TreeStream);
		const FwdTreeStream = forwardRef<HTMLDivElement, React.ComponentProps<typeof TreeStream>>(TreeStream);

		const { container } = render(
			<TreeStream speed={50} interval={1}>
				{'A'}
				<MemoTreeStream>{'A1'}</MemoTreeStream>
				<FwdTreeStream>{'B1'}</FwdTreeStream>
				{'Z'}
			</TreeStream>,
		);
		// Advance timers until complete, then assert wrapper structure
		const outer = container.querySelector('[data-tree-stream]') as HTMLElement;
		await runUntilComplete(outer, 2000, 5);
		const wrappers = container.querySelectorAll('[data-tree-stream]');
		expect(wrappers.length).toBe(3); // outer + two nested wrappers
		wrappers.forEach((el) => expect((el as HTMLElement).tagName).toBe('DIV'));
		const nestedWrappers = Array.from(wrappers).slice(1) as HTMLElement[];
		expect(nestedWrappers.every((w) => w.dataset.complete === 'true')).toBe(true);
		expect(compact(outer.textContent)).toBe('AA1B1Z');
	});
});

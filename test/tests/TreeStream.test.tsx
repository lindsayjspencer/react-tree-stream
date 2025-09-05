import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
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

describe('TreeStream', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});
	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});
	it('should render a div wrapper by default', async () => {
		const { container } = render(<TreeStream>Hello World</TreeStream>);

		act(() => {
			vi.runAllTimers();
		});

		const wrapper = container.querySelector('div[data-tree-stream]');
		expect(wrapper).toBeTruthy();
		expect(container.textContent).toContain('Hello World');
	});

	it('should render a different element when `as` prop is provided', async () => {
		const { container } = render(<TreeStream as="p">Hello World</TreeStream>);

		act(() => {
			vi.runAllTimers();
		});

		const wrapper = container.querySelector('p[data-tree-stream]');
		expect(wrapper).toBeTruthy();
		expect(container.textContent).toContain('Hello World');
	});

	it('should render as a React.Fragment when as="fragment"', async () => {
		const { container } = render(
			<TreeStream as="fragment">
				<span>Fragment Content</span>
			</TreeStream>,
		);

		act(() => {
			vi.runAllTimers();
		});

		// The content should be rendered
		expect(container.textContent).toContain('Fragment Content');

		// There should be no wrapping element with the data-tree-stream attribute
		const wrapper = container.querySelector('[data-tree-stream]');
		expect(wrapper).toBeFalsy();

		// The content should be a direct child of the testing container
		expect(container.firstChild?.nodeName).toBe('SPAN');
	});

	it('should not apply DOM-specific attributes like className when as="fragment"', () => {
		const { container } = render(
			// @ts-expect-error - Testing that className is disallowed and not applied
			<TreeStream as="fragment" className="should-not-exist">
				Content
			</TreeStream>,
		);

		act(() => {
			vi.runAllTimers();
		});

		expect(container.querySelector('.should-not-exist')).toBeNull();
	});

	it('should apply className and other props to the wrapper element', () => {
		const { container } = render(
			<TreeStream className="custom-class" id="test-id">
				Test Content
			</TreeStream>,
		);

		act(() => {
			vi.runAllTimers();
		});

		const wrapper = container.querySelector('[data-tree-stream]');
		expect(wrapper?.className).toBe('custom-class');
		expect(wrapper?.getAttribute('id')).toBe('test-id');
	});

	it('should handle empty content gracefully', () => {
		const { container } = render(<TreeStream children={null} />);

		act(() => {
			vi.runAllTimers();
		});

		const wrapper = container.querySelector('[data-tree-stream]');
		expect(wrapper).toBeTruthy();
		expect((wrapper as HTMLElement)?.dataset.complete).toBe('true');
		expect(container.textContent).toBe('');
	});

	it('should handle numeric content', () => {
		const { container } = render(<TreeStream>{42}</TreeStream>);

		act(() => {
			vi.runAllTimers();
		});

		expect(container.textContent).toBe('42');
	});

	it('should stream character by character when streamBy="character"', () => {
		const { container } = render(
			<TreeStream streamBy="character" speed={1} interval={10}>
				Hi
			</TreeStream>,
		);

		expect(container.textContent).toBe('');

		act(() => {
			vi.advanceTimersByTime(10);
		});
		expect(container.textContent).toBe('H');

		act(() => {
			vi.advanceTimersByTime(10);
		});
		expect(container.textContent).toBe('Hi');
	});
});

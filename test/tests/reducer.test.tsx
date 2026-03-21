import { describe, it, expect } from 'vitest';
import React from 'react';
import { initialStreamState, streamReducer } from '../../package/src/reducer';

describe('streamReducer', () => {
	it('handles a text streaming lifecycle', () => {
		let state = initialStreamState;

		state = streamReducer(state, { type: 'BEGIN_TEXT', unitIndex: 2, tokens: ['Hello', ' ', 'world'] });
		expect(state.text.streaming).toBe(true);
		expect(state.text.activeUnit).toBe(2);
		expect(state.rendered.get(2)).toBe('');

		state = streamReducer(state, { type: 'TEXT_TICK', nextIndex: 2, content: 'Hello ' });
		expect(state.text.index).toBe(2);
		expect(state.rendered.get(2)).toBe('Hello ');

		state = streamReducer(state, { type: 'END_TEXT' });
		expect(state.text.streaming).toBe(false);

		state = streamReducer(state, { type: 'ADVANCE' });
		expect(state.unitIndex).toBe(1);

		state = streamReducer(state, { type: 'COMPLETE' });
		expect(state.complete).toBe(true);
	});

	it('tracks instant and nested units independently', () => {
		const instantNode = <a href="#one">One</a>;
		const nestedNode = <span>Nested</span>;

		let state = initialStreamState;
		state = streamReducer(state, { type: 'INSTANT_RENDER', unitIndex: 0, node: instantNode });
		expect(state.rendered.get(0)).toBe(instantNode);
		expect(state.waitingNested).toBe(false);

		state = streamReducer(state, { type: 'NESTED_START', unitIndex: 1, node: nestedNode });
		expect(state.rendered.get(1)).toBe(nestedNode);
		expect(state.waitingNested).toBe(true);

		state = streamReducer(state, { type: 'NESTED_DONE' });
		expect(state.waitingNested).toBe(false);
	});

	it('resets back to the initial state', () => {
		let state = streamReducer(initialStreamState, { type: 'BEGIN_TEXT', unitIndex: 3, tokens: ['A'] });
		state = streamReducer(state, { type: 'TEXT_TICK', nextIndex: 1, content: 'A' });
		state = streamReducer(state, { type: 'ADVANCE' });
		state = streamReducer(state, { type: 'COMPLETE' });

		const resetState = streamReducer(state, { type: 'RESET' });
		expect(resetState).toEqual(initialStreamState);
		expect(resetState.rendered).not.toBe(state.rendered);
	});
});

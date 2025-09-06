import { describe, it, expect } from 'vitest';
import React, { memo, forwardRef, Fragment } from 'react';
import { buildPlan, planSignature, TreeStream, type ExecutionUnit, type TreeStreamProps } from 'react-tree-stream';

const MemoTreeStream = memo(TreeStream);
const FwdTreeStream = forwardRef<HTMLDivElement, TreeStreamProps<'div'>>(
	TreeStream as unknown as React.ForwardRefRenderFunction<HTMLDivElement, TreeStreamProps<'div'>>,
);

function types(plan: ReturnType<typeof buildPlan>) {
	return plan.map((u: ExecutionUnit) => u.type);
}

describe('plan utilities', () => {
	it('handles strings and numbers', () => {
		const plan = buildPlan(['Hello ', 42, ' !']);
		expect(types(plan)).toEqual(['text_stream', 'text_stream', 'text_stream']);
	});

	it('flattens fragments and arrays', () => {
		const plan = buildPlan(
			<Fragment>
				{'A'}
				{['B', 'C']}
				<Fragment>{'D'}</Fragment>
			</Fragment>,
		);
		expect(types(plan)).toEqual(['text_stream', 'text_stream', 'text_stream', 'text_stream']);
	});

	it('detects nested TreeStream elements including wrappers', () => {
		const plan = buildPlan([
			'A',
			<TreeStream key="1">X</TreeStream>,
			<MemoTreeStream key="2">Y</MemoTreeStream>,
			<FwdTreeStream key="3">Z</FwdTreeStream>,
			'Q',
		]);
		expect(types(plan)).toEqual(['text_stream', 'nested_stream', 'nested_stream', 'nested_stream', 'text_stream']);
	});

	it('produces a stable signature by structure and text', () => {
		const p1 = buildPlan(['A', <span key="1">X</span>, 'B']);
		const p2 = buildPlan(['A', <div key="2">Y</div>, 'B']);
		const p3 = buildPlan(['A', <div key="3">Y</div>, 'C']);
		expect(planSignature(p1)).toBe(planSignature(p2));
		expect(planSignature(p1)).not.toBe(planSignature(p3));
	});
});

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

type ExecutionUnit =
	| { type: 'text_stream'; content: string }
	| { type: 'instant_render'; content: React.ReactElement }
	| { type: 'nested_stream'; component: React.ReactElement };

export interface TreeStreamProps {
	as?: keyof JSX.IntrinsicElements;
	children: React.ReactNode;
	speed?: number; // words per tick
	interval?: number; // ms per tick
	autoStart?: boolean;
	onComplete?: () => void;
	className?: string;
	[key: string]: unknown;
}

/* ----- stable ids (no Date.now) ----- */
let __seq = 0;
const newInstanceId = () => `ts-${++__seq}`;

/* ----- nested detection (handles memo/forwardRef) ----- */
const STREAMING_MARKER = Symbol.for('react-tree-stream/TreeStream');
function isTreeStreamElement(el: React.ReactElement): boolean {
	const t = el.type as unknown as {
		[STREAMING_MARKER]?: boolean;
		type?: { [STREAMING_MARKER]?: boolean };
		render?: { [STREAMING_MARKER]?: boolean };
		displayName?: string;
	};
	return Boolean(
		t?.[STREAMING_MARKER] ||
			t?.type?.[STREAMING_MARKER] || // React.memo
			t?.render?.[STREAMING_MARKER] || // forwardRef
			t?.displayName === 'TreeStream',
	);
}

/* ----- plan builder (recurse fragments/arrays) ----- */
function buildPlan(node: React.ReactNode): ExecutionUnit[] {
	if (node == null || node === false || node === true) return [];
	if (typeof node === 'string') return node.trim() ? [{ type: 'text_stream', content: node }] : [];
	if (typeof node === 'number') return [{ type: 'text_stream', content: String(node) }];
	if (Array.isArray(node)) return node.flatMap(buildPlan);
	if (React.isValidElement(node)) {
		if (node.type === React.Fragment) return buildPlan(node.props?.children);
		if (isTreeStreamElement(node)) return [{ type: 'nested_stream', component: node }];
		return [{ type: 'instant_render', content: node }];
	}
	return [];
}

/* Create a stable signature that ignores element identity but captures structure. */
function planSignature(plan: ExecutionUnit[]): string {
	return JSON.stringify(
		plan.map((u) => {
			switch (u.type) {
				case 'text_stream':
					return ['T', u.content]; // include text so content changes re-run
				case 'nested_stream':
					return ['N']; // structure only
				case 'instant_render':
					return ['I']; // structure only
			}
		}),
	);
}

export function TreeStream({
	as = 'div',
	children,
	speed = 5,
	interval = 50,
	autoStart = true,
	onComplete,
	className = '',
	...elementProps
}: TreeStreamProps) {
	const Element = as;
	const instanceIdRef = useRef<string>(newInstanceId());

	/* Keep latest onComplete in a ref to avoid effect resubscribes */
	const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	/* Build plan & a stable signature */
	const computedPlan = useMemo(() => buildPlan(children), [children]);
	const signature = useMemo(() => planSignature(computedPlan), [computedPlan]);

	/* Store plan in a ref for the executor */
	const planRef = useRef<ExecutionUnit[]>(computedPlan);
	useEffect(() => {
		planRef.current = computedPlan;
	}, [computedPlan]);

	/* scheduling / run guards */
	const runIdRef = useRef(0);
	const timersRef = useRef<number[]>([]);
	const schedule = useCallback((fn: () => void, delay = 0) => {
		const thisRun = runIdRef.current;
		const t = window.setTimeout(() => {
			if (runIdRef.current === thisRun) fn();
		}, delay);
		timersRef.current.push(t);
	}, []);

	/* render state */
	const [currentUnit, setCurrentUnit] = useState(0);
	const [isWaitingForNested, setIsWaitingForNested] = useState(false);
	const [renderedContent, setRenderedContent] = useState<Array<{ key: string; content: React.ReactNode }>>([]);

	/* text streaming */
	const [currentTextWords, setCurrentTextWords] = useState<string[]>([]);
	const [currentWordIndex, setCurrentWordIndex] = useState(0);
	const [isStreamingText, setIsStreamingText] = useState(false);
	const [isComplete, setIsComplete] = useState(false);

	/* only patch the active streamed node */
	const activeTextKeyRef = useRef<string | null>(null);

	/* stable keys */
	const textKey = (u: number) => `${instanceIdRef.current}:u${u}:t`;
	const instKey = (u: number) => `${instanceIdRef.current}:u${u}:i`;
	const nestKey = (u: number) => `${instanceIdRef.current}:u${u}:n`;

	/* executor (reads plan from ref; no deps) */
	const executeUnit = useCallback((unitIndex: number) => {
		const plan = planRef.current;
		if (unitIndex >= plan.length) {
			setIsComplete(true);
			onCompleteRef.current?.();
			return;
		}
		const unit = plan[unitIndex];
		if (!unit) return;
		switch (unit.type) {
			case 'text_stream': {
				const words = unit.content.split(/(\s+)/); // keep whitespace
				const k = textKey(unitIndex);
				activeTextKeyRef.current = k;
				setCurrentTextWords(words);
				setCurrentWordIndex(0);
				setIsStreamingText(true);
				setRenderedContent((prev) =>
					prev.some((p) => p.key === k) ? prev : [...prev, { key: k, content: '' }],
				);
				break;
			}
			case 'instant_render': {
				setRenderedContent((prev) => [...prev, { key: instKey(unitIndex), content: unit.content }]);
				const next = unitIndex + 1;
				setCurrentUnit(next);
				schedule(() => executeUnit(next), 0);
				break;
			}
			case 'nested_stream': {
				setIsWaitingForNested(true);
				/* compose child's onComplete with parent advance */
				const child = unit.component;
				const childExisting = (child.props as { onComplete?: () => void })?.onComplete as
					| (() => void)
					| undefined;
				const composed = () => {
					try {
						childExisting?.();
					} finally {
						setIsWaitingForNested(false);
						const next = unitIndex + 1;
						setCurrentUnit(next);
						schedule(() => executeUnit(next), 0);
					}
				};
				const nestedWithCb = React.cloneElement(child, {
					...child.props,
					autoStart: true,
					onComplete: composed,
				});
				setRenderedContent((prev) => [...prev, { key: nestKey(unitIndex), content: nestedWithCb }]);
				break; // wait for nested to call back
			}
		}
	}, []);

	/* text tick */
	useEffect(() => {
		if (!isStreamingText || currentTextWords.length === 0) return;
		if (currentWordIndex >= currentTextWords.length) {
			setIsStreamingText(false);
			const next = currentUnit + 1;
			setCurrentUnit(next);
			schedule(() => executeUnit(next), 0);
			return;
		}
		const t = window.setTimeout(() => {
			const step = Math.max(1, speed ?? 1);
			const nextIndex = Math.min(currentWordIndex + step, currentTextWords.length);
			const textContent = currentTextWords.slice(0, nextIndex).join('');
			const k = activeTextKeyRef.current;
			setRenderedContent((prev) => {
				if (!k) return prev;
				const idx = prev.findIndex((p) => p.key === k);
				if (idx === -1) return [...prev, { key: k, content: textContent }];
				const clone = prev.slice();
				clone[idx] = { key: k, content: textContent };
				return clone;
			});
			setCurrentWordIndex(nextIndex);
		}, Math.max(0, interval ?? 0));
		timersRef.current.push(t);
		return () => clearTimeout(t);
	}, [isStreamingText, currentTextWords, currentWordIndex, speed, interval, currentUnit, executeUnit, schedule]);

	/* reset ONLY when the signature or autoStart change */
	useEffect(() => {
		runIdRef.current += 1;
		timersRef.current.forEach(clearTimeout);
		timersRef.current = [];
		activeTextKeyRef.current = null;

		setCurrentUnit(0);
		setIsWaitingForNested(false);
		setRenderedContent([]);
		setCurrentTextWords([]);
		setCurrentWordIndex(0);
		setIsStreamingText(false);
		setIsComplete(false);

		const planLen = planRef.current.length;
		if (planLen === 0) {
			setIsComplete(true);
			onCompleteRef.current?.();
			return;
		}
		if (autoStart) executeUnit(0);

		return () => {
			timersRef.current.forEach(clearTimeout);
			timersRef.current = [];
		};
	}, [signature, autoStart, executeUnit]);

	// Memoise element creation
	const element = useMemo(() => {
		const incomingStyle = (elementProps as { style?: React.CSSProperties })?.style || {};
		return (
			<Element
				{...elementProps}
				className={className}
				style={incomingStyle}
				data-tree-stream
				data-streaming={isStreamingText || isWaitingForNested}
				data-complete={isComplete}
			>
				{renderedContent.map((item) => (
					<React.Fragment key={item.key}>{item.content}</React.Fragment>
				))}
			</Element>
		);
	}, [Element, elementProps, className, isStreamingText, isWaitingForNested, isComplete, renderedContent]);

	return element;
}

/* mark component for wrapped detection */
(TreeStream as unknown as Record<string | symbol, unknown>)[STREAMING_MARKER] = true;
TreeStream.displayName = 'TreeStream';

export default TreeStream;

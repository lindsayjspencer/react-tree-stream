'use client';

import React, { useEffect, useMemo, useCallback, useRef, useId, useReducer } from 'react';
import { STREAMING_MARKER } from './nested';
import { buildPlan, planSignature, type ExecutionUnit } from './plan';
import { useSequentialScheduler } from './useSequentialScheduler';
import { initialStreamState, streamReducer } from './reducer';

/**
 * TreeStream
 *
 * A client-only React component that renders its children incrementally over time.
 * It walks the provided React node tree into a linear execution plan of units:
 *  - text units (streamed by word or character)
 *  - element units (regular React elements rendered as a single sequenced step)
 *  - nested stream units (child TreeStream elements, coordinated by onComplete)
 *
 * Contract (inputs/outputs):
 *  - Props:
 *    - as: optional polymorphic element type; use 'fragment' for no wrapper
 *    - children: any renderable React nodes; fragments/arrays are flattened
 *    - speed: number of units per tick (words, characters, or element units)
 *    - interval: ms between ticks
 *    - streamBy: 'word' | 'character' determines tokenization of text units
 *    - autoStart: start streaming automatically when inputs/signature change
 *    - onStart: called when a new run starts
 *    - onUnitStart/onUnitComplete: called for each unit as it begins/completes
 *    - onComplete: called after the final unit completes (including nested)
 *  - DOM: adds data attributes for observability:
 *    - data-tree-stream, data-streaming, data-complete
 *  - SSR: client-only ('use client'); streaming occurs in the browser
 *
 * Notes:
 *  - Plain React elements are atomic units in the parent stream: the element
 *    appears when its turn is reached, but its internals are not tokenized.
 *  - Nested TreeStream children have autoStart forced to true, and their
 *    onComplete is composed so the parent resumes after the child completes.
 *  - A stable "plan signature" is used to reset the stream only when structure
 *    or text content changes; this limits unnecessary restarts.
 */

// ExecutionUnit is now imported from ./plan

/**
 * Props for TreeStream.
 * - speed: tokens per tick (>= 1). Tokens are words or characters per streamBy.
 * - interval: delay between ticks in ms.
 * - streamBy: tokenization strategy for text nodes.
 * - autoStart: if false, the component initializes idle until inputs change again or programmatically started in a future version.
 */
/**
 * Core properties for the TreeStream component
 */
type OwnProps = {
	/**
	 * Number of tokens to display per tick (must be >= 1).
	 * Tokens are either words or characters based on the `streamBy` prop.
	 * @default 5
	 */
	speed?: number;
	/**
	 * Delay between ticks in milliseconds.
	 * Controls the animation speed of the streaming effect.
	 * @default 50
	 */
	interval?: number;
	/**
	 * Tokenization strategy for text nodes.
	 * - 'word': Text is split and streamed word by word
	 * - 'character': Text is split and streamed character by character
	 * @default 'word'
	 */
	streamBy?: 'word' | 'character';
	/**
	 * Whether to automatically start streaming when the component mounts
	 * or when inputs/signature change. If false, the component initializes
	 * in an idle state.
	 * @default true
	 */
	autoStart?: boolean;
	/**
	 * Callback invoked after all content (including nested TreeStream components)
	 * has finished streaming.
	 */
	onComplete?: () => void;
	/**
	 * Callback invoked when a stream run starts.
	 */
	onStart?: () => void;
	/**
	 * Callback invoked when a unit begins processing.
	 */
	onUnitStart?: (event: TreeStreamUnitEvent) => void;
	/**
	 * Callback invoked when a unit has finished processing.
	 */
	onUnitComplete?: (event: TreeStreamUnitEvent) => void;
};

export type TreeStreamUnitEvent = {
	unitIndex: number;
	unit: ExecutionUnit;
};

type AsProp<E extends React.ElementType> = { as?: E };
type PropsToOmit<E extends React.ElementType> = keyof (AsProp<E> & OwnProps);
type PolymorphicProps<E extends React.ElementType> = AsProp<E> &
	OwnProps &
	Omit<React.ComponentPropsWithoutRef<E>, PropsToOmit<E>>;
type FragmentPropsGuard<E extends React.ElementType> = E extends typeof React.Fragment
	? { className?: never; style?: never }
	: {};

/**
 * Props for the TreeStream component with polymorphic support.
 *
 * @template E - The element type for the wrapper component
 * @example
 * ```tsx
 * // Default div wrapper
 * <TreeStream>Content</TreeStream>
 *
 * // Custom element wrapper
 * <TreeStream as="section">Content</TreeStream>
 *
 * // No wrapper (fragment)
 * <TreeStream as={React.Fragment}>Content</TreeStream>
 * ```
 */
export type TreeStreamProps<E extends React.ElementType = 'div'> = PolymorphicProps<E> & FragmentPropsGuard<E>;

// Stable instance id for keys (SSR-friendly and deterministic)
// Prefer useId over custom counters for readability and testability

// Helper to detect fragment usage
function isFragmentElementType(as: React.ElementType | undefined): as is typeof React.Fragment {
	return as === React.Fragment;
}

// buildPlan and planSignature are imported from ./plan

/**
 * TreeStream - A React component that renders content with a streaming animation effect.
 *
 * Renders children incrementally over time, creating a typewriter-like effect.
 * Supports text streaming (by word or character), sequencing plain React elements
 * as atomic units, and nested TreeStream components with coordinated completion callbacks.
 *
 * @template E - The element type for the wrapper component (defaults to 'div')
 * @param props - The component props
 * @param props.as - Optional polymorphic element type. Use React.Fragment for no wrapper
 * @param props.children - React nodes to stream. Fragments and arrays are flattened
 * @param props.speed - Number of units to advance per tick (default: 5)
 * @param props.interval - Minimum delay between ticks (default: 50)
 * @param props.streamBy - Tokenization strategy: 'word' or 'character' (default: 'word')
 * @param props.autoStart - Start streaming automatically on mount/change (default: true)
 * @param props.onStart - Callback when a stream run starts
 * @param props.onUnitStart - Callback when a unit begins processing
 * @param props.onUnitComplete - Callback when a unit finishes processing
 * @param props.onComplete - Callback when streaming completes (including nested streams)
 *
 * @returns A React element that streams its content progressively
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TreeStream speed={10} interval={30}>
 *   Hello world! This text will stream in.
 * </TreeStream>
 *
 * // Character-by-character streaming
 * <TreeStream streamBy="character" speed={1}>
 *   Typing effect...
 * </TreeStream>
 *
 * // With completion callback
 * <TreeStream onComplete={() => console.log('Done!')}>
 *   Content here
 * </TreeStream>
 *
 * // Nested streaming components
 * <TreeStream>
 *   First part
 *   <TreeStream>Nested content streams after parent</TreeStream>
 *   Final part
 * </TreeStream>
 * ```
 */
export function TreeStream<E extends React.ElementType = 'div'>({
	as,
	children,
	speed = 5,
	interval = 50,
	streamBy = 'word',
	autoStart = true,
	onComplete,
	onStart,
	onUnitStart,
	onUnitComplete,
	...rest
}: TreeStreamProps<E>) {
	const instanceId = useId();
	const tickStep = Math.max(1, speed ?? 1);
	const tickDelay = Math.max(0, interval ?? 0);

	// Keep latest callbacks in refs to avoid effect resubscribes
	const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
	const onStartRef = useRef<(() => void) | undefined>(onStart);
	const onUnitStartRef = useRef<((event: TreeStreamUnitEvent) => void) | undefined>(onUnitStart);
	const onUnitCompleteRef = useRef<((event: TreeStreamUnitEvent) => void) | undefined>(onUnitComplete);
	useEffect(() => {
		onCompleteRef.current = onComplete;
		onStartRef.current = onStart;
		onUnitStartRef.current = onUnitStart;
		onUnitCompleteRef.current = onUnitComplete;
	}, [onComplete, onStart, onUnitStart, onUnitComplete]);

	// Build plan & a stable signature
	const plan = useMemo(() => buildPlan(children), [children]);
	const signature = useMemo(() => planSignature(plan), [plan]);

	// Store latest plan in a ref for the executor (avoids callback deps churn)
	const latestPlanRef = useRef<ExecutionUnit[]>(plan);
	useEffect(() => {
		latestPlanRef.current = plan;
	}, [plan]);

	// Centralized scheduler for timers and run guards
	const { schedule: scheduleNext, cancelAll, nextRunToken } = useSequentialScheduler();

	// Internal state managed via reducer
	const [state, dispatch] = useReducer(streamReducer, initialStreamState);
	const {
		unitIndex: currentUnit,
		waitingNested: isWaitingForNested,
		rendered: renderedMap,
		text,
		complete: isComplete,
	} = state;
	const activeTextUnitRef = useRef<number | null>(text.activeUnit);

	// Executor (reads latest plan from ref; stable callback)
	const runUnit = useCallback(
		(unitIndex: number, componentBudget = tickStep, hasConsumedComponent = false) => {
			const currentPlan = latestPlanRef.current;
			if (unitIndex >= currentPlan.length) {
				dispatch({ type: 'COMPLETE' });
				onCompleteRef.current?.();
				return;
			}

			const completeStream = () => {
				dispatch({ type: 'COMPLETE' });
				onCompleteRef.current?.();
			};
			let nextUnitIndex = unitIndex;
			let remainingBudget = componentBudget;
			let consumedComponentThisTick = hasConsumedComponent;

			while (nextUnitIndex < currentPlan.length) {
				const unit = currentPlan[nextUnitIndex];
				if (!unit) return;

				switch (unit.type) {
					case 'text_stream': {
						if (consumedComponentThisTick) {
							scheduleNext(() => runUnit(nextUnitIndex), tickDelay);
							return;
						}

						const units = streamBy === 'character' ? unit.content.split('') : unit.content.split(/(\s+)/);
						onUnitStartRef.current?.({ unitIndex: nextUnitIndex, unit });
						activeTextUnitRef.current = nextUnitIndex;
						dispatch({ type: 'BEGIN_TEXT', unitIndex: nextUnitIndex, tokens: units });
						return;
					}
					case 'instant_render': {
						onUnitStartRef.current?.({ unitIndex: nextUnitIndex, unit });
						dispatch({ type: 'INSTANT_RENDER', unitIndex: nextUnitIndex, node: unit.content });
						onUnitCompleteRef.current?.({ unitIndex: nextUnitIndex, unit });
						dispatch({ type: 'ADVANCE' });
						nextUnitIndex += 1;
						remainingBudget -= 1;
						consumedComponentThisTick = true;

						if (remainingBudget > 0) {
							continue;
						}

						if (nextUnitIndex >= currentPlan.length) {
							completeStream();
							return;
						}

						scheduleNext(() => runUnit(nextUnitIndex), tickDelay);
						return;
					}
					case 'nested_stream': {
						// Compose child's onComplete with parent advance
						const child = unit.component;
						const childExisting = (child.props as { onComplete?: () => void })?.onComplete as
							| (() => void)
							| undefined;
						const followingUnitIndex = nextUnitIndex + 1;
						const remainingBudgetAfterChild = remainingBudget - 1;
						onUnitStartRef.current?.({ unitIndex: nextUnitIndex, unit });
						const composed = () => {
							try {
								childExisting?.();
							} finally {
								dispatch({ type: 'NESTED_DONE' });
								onUnitCompleteRef.current?.({ unitIndex: nextUnitIndex, unit });
								dispatch({ type: 'ADVANCE' });

								if (followingUnitIndex >= latestPlanRef.current.length) {
									completeStream();
									return;
								}

								if (remainingBudgetAfterChild > 0) {
									runUnit(followingUnitIndex, remainingBudgetAfterChild, true);
									return;
								}

								scheduleNext(() => runUnit(followingUnitIndex), tickDelay);
							}
						};
						const nestedWithCb = React.cloneElement(child, {
							...child.props,
							autoStart: true,
							onComplete: composed,
						});
						dispatch({ type: 'NESTED_START', unitIndex: nextUnitIndex, node: nestedWithCb });
						return; // wait for nested to call back
					}
				}
			}

			completeStream();
		},
		[scheduleNext, streamBy, tickDelay, tickStep],
	);

	// Text tick
	useEffect(() => {
		if (!text.streaming || text.tokens.length === 0) return;
		if (text.index >= text.tokens.length) {
			const activeUnit = activeTextUnitRef.current;
			const completedUnit = activeUnit != null ? latestPlanRef.current[activeUnit] : undefined;
			if (activeUnit != null && completedUnit) {
				onUnitCompleteRef.current?.({ unitIndex: activeUnit, unit: completedUnit });
			}
			dispatch({ type: 'END_TEXT' });
			const next = currentUnit + 1;
			dispatch({ type: 'ADVANCE' });

			if (next >= latestPlanRef.current.length) {
				dispatch({ type: 'COMPLETE' });
				onCompleteRef.current?.();
				return;
			}

			scheduleNext(() => runUnit(next), tickDelay);
			return;
		}
		scheduleNext(() => {
			const nextIndex = Math.min(text.index + tickStep, text.tokens.length);
			const textContent = text.tokens.slice(0, nextIndex).join('');
			dispatch({ type: 'TEXT_TICK', nextIndex, content: textContent });
		}, tickDelay);
	}, [text.streaming, text.tokens, text.index, tickStep, tickDelay, currentUnit, runUnit, scheduleNext]);

	// Reset ONLY when the signature or autoStart change
	useEffect(() => {
		nextRunToken();
		activeTextUnitRef.current = null;
		dispatch({ type: 'RESET' });

		const planLen = latestPlanRef.current.length;
		if (planLen === 0) {
			dispatch({ type: 'COMPLETE' });
			onCompleteRef.current?.();
			return;
		}
		if (autoStart) {
			onStartRef.current?.();
			runUnit(0);
		}

		return () => {
			cancelAll();
		};
	}, [signature, autoStart, runUnit, nextRunToken, cancelAll]);

	// Memoise element creation
	const element = useMemo(() => {
		const children = Array.from(renderedMap.entries()).map(([unitIndex, content]) => (
			<React.Fragment key={`${instanceId}:u${unitIndex}`}>{content}</React.Fragment>
		));

		if (isFragmentElementType(as)) {
			return <React.Fragment>{children}</React.Fragment>;
		}

		// The type guard ensures `as` is not Fragment here.
		const Element = (as || 'div') as React.ElementType;
		const { className, style, ...elementProps } = rest as {
			className?: string;
			style?: React.CSSProperties;
			[key: string]: unknown;
		};
		const props = {
			...elementProps,
			className,
			style,
			'data-tree-stream': true,
			'data-streaming': text.streaming || isWaitingForNested,
			'data-complete': isComplete,
		};

		return <Element {...props}>{children}</Element>;
	}, [as, rest, text.streaming, isWaitingForNested, isComplete, renderedMap, instanceId]);

	return element;
}

/* mark component for wrapped detection */
(TreeStream as unknown as Record<string | symbol, unknown>)[STREAMING_MARKER] = true;
TreeStream.displayName = 'TreeStream';

export default TreeStream;

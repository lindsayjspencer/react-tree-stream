# React Tree Stream

[![npm version](https://badge.fury.io/js/react-tree-stream.svg)](https://badge.fury.io/js/react-tree-stream)

A flexible React component for creating "streaming" or "typewriter" effects on your content. It intelligently renders text, components, and even nested streams sequentially.

## Features

-   **Text Streaming**: Renders text content word-by-word, like a typewriter.
-   **Component Rendering**: Instantly renders any non-text React components.
-   **Nested Streams**: Supports nesting `TreeStream` components, waiting for each to complete before continuing.
-   **Customizable**: Control the streaming speed and the underlying HTML element.
-   **Callbacks**: `onComplete` event fires when the entire stream is finished.
-   **Dynamic Content**: Automatically restarts the stream if its children change.
-   **Styling Hooks**: Provides `data-streaming` and `data-complete` attributes for easy CSS styling.
-   **Type-Safe**: Fully typed with TypeScript, including props for the underlying element.

## Installation

```bash
npm install react-tree-stream
# or
yarn add react-tree-stream
```

## Usage

### Basic Example

Wrap your content with `TreeStream` to start streaming.

```tsx
import { TreeStream } from 'react-tree-stream';

function App() {
	return (
		<TreeStream>
			This is a simple example of streaming text content. The component will render this sentence
			word by word.
		</TreeStream>
	);
}
```

### Mixed Content

`TreeStream` can handle a mix of text and React components. Text is streamed, while components are rendered instantly.

```tsx
import { TreeStream } from 'react-tree-stream';

const MyComponent = () => <div style={{ padding: '1rem', background: '#eee' }}>I am a component!</div>;

function App() {
	return (
		<TreeStream>
			Here is some text.
			<MyComponent />
			And here is some more text that will appear after the component.
		</TreeStream>
	);
}
```

### Nested Streams

You can nest `TreeStream` components. The parent stream will pause and wait for the nested stream to complete before it continues.

```tsx
import { TreeStream } from 'react-tree-stream';

function App() {
	return (
		<TreeStream>
			This is the parent stream. It will pause here...
			<TreeStream as="blockquote" speed={10}>
				...and this nested stream will run to completion. Once it's done...
			</TreeStream>
			...the parent stream will resume.
		</TreeStream>
	);
}
```

### Character-by-Character Streaming

By default, `TreeStream` streams text content word-by-word. You can change this behavior to stream text character-by-character.

```tsx
import { TreeStream } from 'react-tree-stream';

function App() {
	return (
		<TreeStream streamBy="character">
			This text is being streamed one character at a time. You can change the streaming behavior
			to be more granular.
		</TreeStream>
	);
}
```

## API and Props

The component accepts the following props:

| Prop         | Type                               | Default | Description                                                                                             |
| ------------ | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `as`         | `keyof JSX.IntrinsicElements`      | `'div'` | The HTML tag to render as the root element.                                                             |
| `children`   | `React.ReactNode`                  |         | The content to be streamed.                                                                             |
| `speed`      | `number`                           | `5`     | The number of units (words, characters, or components) to render per tick.                                                                 |
| `interval`   | `number`                           | `50`    | The delay in milliseconds between each rendering tick.                                                  |
| `autoStart`  | `boolean`                          | `true`  | If `true`, the stream starts automatically on mount. If `false`, it waits for `autoStart` to become `true`. |
| `onComplete` | `() => void`                       |         | A callback function that is invoked when the entire stream has finished rendering.                      |
| `streamBy`   | `'word' \| 'character'`           | `'word'`| Determines the granularity of the streaming. Use `'word'` for word-by-word streaming or `'character'` for character-by-character streaming. |
| `...rest`    | `React.ComponentPropsWithoutRef<T>` |         | Any other props are passed down to the root element specified by the `as` prop (e.g., `className`, `style`). |

## Styling

The root element rendered by `TreeStream` includes data attributes that reflect its current state, which you can use for styling.

-   `data-tree-stream`: Always present on the component's root element.
-   `data-streaming="true"`: Present while the component is actively streaming text or waiting for a nested stream.
-   `data-complete="true"`: Present when the stream has finished.

### Example: Blinking Cursor

You can use these attributes to create a blinking cursor effect that appears only during streaming.

```css
/* Your CSS file */
[data-streaming='true']::after {
	content: '▋';
	animation: blink 1s step-end infinite;
}

@keyframes blink {
	50% {
		opacity: 0;
	}
}
```
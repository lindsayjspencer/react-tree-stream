# React Tree Stream

[![npm version](https://badge.fury.io/js/react-tree-stream.svg)](https://badge.fury.io/js/react-tree-stream)

A flexible React component for creating "streaming" or "typewriter" effects on your content. It walks your React tree sequentially, streaming text over time and treating elements as atomic units in the flow.

## Features

-   **Text Streaming**: Renders text content word-by-word or character-by-character.
-   **Element Sequencing**: Plain React elements count as single units in the stream.
-   **Nested Streams**: Supports nesting `TreeStream` components, waiting for each to complete before continuing.
-   **Customizable**: Control streaming speed, timing, and the underlying HTML element.
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

`TreeStream` can handle a mix of text and React components. Text is tokenized and streamed over time, while plain React elements appear as atomic units when their turn is reached.

```tsx
import { TreeStream } from 'react-tree-stream';

const MyComponent = () => (
  <div style={{ padding: '1rem', background: '#eee' }}>I am a component!</div>
);

function App() {
  return (
    <TreeStream speed={1} interval={80}>
      Here is some text.
      <MyComponent />
      And here is some more text that will appear after the component.
    </TreeStream>
  );
}
```

In this example:

- `Here is some text.` streams according to `streamBy`
- `<MyComponent />` appears as one sequenced unit
- the trailing text resumes after that element

### Nested Streams

You can nest `TreeStream` components. A nested `TreeStream` is one unit in the parent flow, but it can stream its own contents internally. The parent stream pauses and waits for the nested stream to complete before it continues.

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

## Mental Model

`TreeStream` turns its direct children into a linear execution plan:

- Plain text becomes streamed text tokens
- Plain React elements become one atomic sequenced unit
- Nested `TreeStream` elements become one sequenced unit that may stream internally

This means you control grouping through normal React structure:

- Want several things to appear together: wrap them in a single non-`TreeStream` element
- Want sibling elements to appear one-by-one: render them as siblings
- Want an element's own contents to stream: render that subtree as `TreeStream`

Example:

```tsx
<TreeStream speed={1} interval={50}>
  <a>Some link</a>
  <a>Another link</a>
  <TreeStream as="strong">Emphasized text</TreeStream>
  And then some trailing text
</TreeStream>
```

With this setup:

- each `<a>` counts as one unit in the parent stream
- `<TreeStream as="strong">` counts as one parent unit, but streams inside the `<strong>`
- the trailing text streams after those units are reached

## Polymorphic `as` prop

TreeStream is polymorphic: you can render it as any element or component using `as?: React.ElementType`.

- Semantic tags: `<TreeStream as="section" role="region">...`
- Custom components: pass your wrapper and forward props to a DOM element so `data-*`, `className`, and `style` reach the node.
- Fragments: `<TreeStream as={React.Fragment}>` renders no wrapper. In this mode, DOM-specific props like `className` and `style` are disallowed and the `data-*` attributes are not rendered (no wrapper node).

Example custom wrapper:

```tsx
const Custom = ({ children, ...rest }: React.PropsWithChildren<React.ComponentPropsWithoutRef<'div'>>) => (
  <div {...rest}>{children}</div>
);

<TreeStream as={Custom} className="panel" data-testid="stream">Text</TreeStream>
```

When using `as={React.Fragment}`, omit DOM-only props:

```tsx
<TreeStream as={React.Fragment}>No wrapper here</TreeStream>
```

## API and Props

The component accepts the following props:

| Prop         | Type                               | Default | Description                                                                                             |
| ------------ | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `as`         | `React.ElementType`                | `'div'` | The element or component to render as the root; supports intrinsic tags, custom components, or `React.Fragment`. |
| `children`   | `React.ReactNode`                  |         | The content to be streamed.                                                                             |
| `speed`      | `number`                           | `5`     | The number of units to advance per tick. Units are words, characters, plain elements, or nested `TreeStream` boundaries. |
| `interval`   | `number`                           | `50`    | The delay in milliseconds between rendering ticks. |
| `autoStart`  | `boolean`                          | `true`  | If `true`, the stream starts automatically on mount. If `false`, it waits for `autoStart` to become `true`. |
| `onComplete` | `() => void`                       |         | A callback function that is invoked when the entire stream has finished rendering.                      |
| `streamBy`   | `'word' \| 'character'`           | `'word'`| Determines the granularity of the streaming. Use `'word'` for word-by-word streaming or `'character'` for character-by-character streaming. |
| `...rest`    | `ComponentPropsWithoutRef<typeof as>` |         | Any other props are forwarded to the chosen element/component. For `React.Fragment`, DOM-only props are not allowed. |

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

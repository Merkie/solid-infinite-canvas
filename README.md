<p align="center">
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-infinite-canvas&background=tiles&project=%20" alt="solid-infinite-canvas">
</p>

# solid-infinite-canvas

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)
[![NPM Version](https://img.shields.io/npm/v/solid-infinite-canvas?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/solid-infinite-canvas)
[![MIT License](https://img.shields.io/github/license/merkie/solid-infinite-canvas?style=for-the-badge)](https://github.com/merkie/solid-infinite-canvas/blob/main/LICENSE)

A powerful and flexible library for creating infinite, pannable, and zoomable canvases in SolidJS. Perfect for building diagrams, whiteboards, or any node-based editor.

---

## Table of Contents

- [solid-infinite-canvas](#solid-infinite-canvas)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API \& Usage](#api--usage)
    - [Defining Element Components](#defining-element-components)
    - [Updating State](#updating-state)
    - [Custom Backgrounds](#custom-backgrounds)
    - [Multiple Stages](#multiple-stages)
  - [License](#license)

---

## Features

- ✨ **Infinite Canvas**: Pan and zoom on a limitless 2D stage.
- 📦 **Custom Elements**: Render any SolidJS component as a canvas element.
- 🖐️ **Transform Controls**: Built-in, customizable controls for moving and resizing elements.
- ⚡️ **Reactive State**: A simple and powerful API to manage canvas and element state, built on SolidJS signals.
- 🎨 **Custom Backgrounds**: Easily create dynamic, grid-based, or static backgrounds.
- ⚫️ **Multiple Stages**: Render multiple independent canvases on the same page.
- 🟦 **Fully Typed**: Written in TypeScript for a great developer experience.

---

## Installation

```bash
# pnpm
pnpm add solid-infinite-canvas

# npm
npm install solid-infinite-canvas

# yarn
yarn add solid-infinite-canvas
```

---

## Quick Start

Get started by creating a `stage` and rendering it with the `<Stage>` component.

```tsx
import { onMount } from 'solid-js'
import { createStageContext, Stage, ElementTransformControls } from 'solid-infinite-canvas'

// 1. Create a stage context
const stage = createStageContext()

function App() {
  // 2. Add elements to the stage
  onMount(() => {
    stage.createElement({
      type: 'rectangle',
      rect: { x: 100, y: 100, width: 150, height: 100 },
      props: { color: 'cornflowerblue' },
    })
    stage.createElement({
      type: 'circle',
      rect: { x: 300, y: 250, width: 100, height: 100 },
      props: { color: 'tomato' },
    })
  })

  return (
    // 3. Render the stage and define your elements
    <Stage
      class="w-full h-[600px] border rounded-lg"
      stage={stage}
      components={{
        elements: {
          rectangle: ({ element, elementId }) => (
            <>
              <div
                class="absolute inset-0 w-full h-full"
                style={{ 'background-color': element.props.color }}
              />
              <ElementTransformControls elementId={elementId} />
            </>
          ),
          circle: ({ element, elementId }) => (
            <>
              <div
                class="absolute inset-0 w-full h-full rounded-full"
                style={{ 'background-color': element.props.color }}
              />
              <ElementTransformControls elementId={elementId} />
            </>
          ),
        },
      }}
    />
  )
}
```

---

## API & Usage

### Defining Element Components

For better organization and type safety, define your elements as separate components. Use the `CanvasElementComponent` type for props.

```tsx
import { CanvasElementComponent, useStage, ElementTransformControls } from 'solid-infinite-canvas'

const CircleElement: CanvasElementComponent = ({ element, elementId }) => {
  const { setState } = useStage()

  const currentCount = () => element.props.count || 0

  return (
    <>
      <div
        class="circle-body"
        onClick={() => {
          // Update the element's state when clicked
          setState('elements', elementId, 'props', 'count', c => (c || 0) + 1)
        }}
      >
        Clicked: {currentCount()}
      </div>
      <ElementTransformControls elementId={elementId} />
    </>
  )
}
```

### Updating State

The `useStage` hook gives you access to the stage's context, including the powerful `setState` function. You can use it to modify any part of the stage's state, such as an element's props.

```tsx
const RectangleElement: CanvasElementComponent = ({ element, elementId }) => {
  const { setState } = useStage()

  // Change to a random color on click
  const changeColor = () => {
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`
    setState('elements', elementId, 'props', 'color', randomColor)
  }

  return (
    <div
      class="rectangle-body"
      style={{ 'background-color': element.props.color }}
      onClick={changeColor}
    >
      Click Me!
    </div>
  )
}
```

### Custom Backgrounds

Pass a custom component to the `background` prop of the `<Stage>` component. Use the `useStage` hook to access the `camera` state to create a background that responds to panning and zooming.

```tsx
import { useStage } from 'solid-infinite-canvas'

function CustomGridBackground() {
  const { camera } = useStage()
  return (
    <div
      style={{
        'pointer-events': 'none',
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'background-position': `${camera().x}px ${camera().y}px`,
        'background-size': `${40 * camera().zoom}px ${40 * camera().zoom}px`,
        'background-image': `radial-gradient(circle, #444 1px, transparent 1px)`,
        'background-color': '#1a1a1a',
      }}
    />
  )
}

// Then, in your main component:
;<Stage
  stage={stage}
  components={{
    background: CustomGridBackground,
    elements: {
      /* ... your elements ... */
    },
  }}
/>
```

### Multiple Stages

Create and render multiple independent stages by calling `createStageContext` for each one.

```tsx
// Create two separate stage contexts
const stageOne = createStageContext();
const stageTwo = createStageContext();

// Add elements to stageOne, stageTwo...

// Render them
function App() {
  return (
    <div class="flex gap-4">
      <Stage class="w-1/2 h-full" stage={stageOne} components={...} />
      <Stage class="w-1/2 h-full" stage={stageTwo} components={...} />
    </div>
  );
}
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=./LICENSE) file for details.

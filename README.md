<p align="center">
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-infinite-canvas&background=tiles&project=%20" alt="solid-infinite-canvas">
</p>

# solid-infinite-canvas

[](https://pnpm.io/)
[](https://www.npmjs.com/package/solid-infinite-canvas)
[](https://github.com/merkie/solid-infinite-canvas/blob/main/LICENSE)

A powerful and flexible library for creating infinite, pannable, and zoomable canvases in SolidJS. Perfect for building diagrams, whiteboards, or any node-based editor. 🚀

---

## Features

- ✨ **Infinite Canvas**: Pan and zoom on a limitless 2D stage.
- 📦 **Custom Elements**: Render any SolidJS component as a canvas element.
- 🔌 **Plugin System**: Easily extend functionality with plugins for features like resizing, connections, etc.
- ⚡️ **Reactive State**: A simple and powerful API to manage canvas and element state, built on SolidJS signals.
- 🎨 **Custom Backgrounds**: Create dynamic, grid-based, or static backgrounds.
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

Getting started is easy. Just create a stage context, define your element components, and render the `<Stage>`.

```tsx
import { onMount } from 'solid-js'
import { createStageContext, Stage, CanvasElementComponent, useStage } from 'solid-infinite-canvas'

// 1. Define your custom element component
const RectangleElement: CanvasElementComponent = ({ element, elementId }) => {
  const { setState } = useStage()

  const changeColor = () => {
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`
    setState('elements', elementId, 'props', 'color', randomColor)
  }

  return (
    <div
      onClick={changeColor}
      style={{
        width: '100%',
        height: '100%',
        'background-color': element.props.color,
        border: '1px solid black',
        color: 'white',
        display: 'grid',
        'place-items': 'center',
        cursor: 'pointer',
      }}
    >
      Click Me!
    </div>
  )
}

// 2. Create a stage context
const stageContext = createStageContext()
const { actions } = stageContext

function App() {
  // 3. Add elements to the stage
  onMount(() => {
    actions.createElement({
      type: 'rectangle',
      rect: { x: 100, y: 100, width: 150, height: 100 },
      props: { color: 'cornflowerblue' },
    })
  })

  return (
    // 4. Render the Stage component (the Stage component fills its parent)
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Stage
        context={stageContext}
        components={{
          elements: {
            rectangle: RectangleElement,
          },
        }}
      />
    </div>
  )
}

export default App
```

---

## Core Concepts

### The Stage Context

Everything in the canvas revolves around a **stage context**. You create one with `createStageContext()`.

```ts
const stageContext = createStageContext()
```

This context object contains:

- `state`: A SolidJS store holding the state for all elements, cursors, etc.
- `setState`: The function to update the state.
- `camera`: A signal with the current `{ x, y, zoom }` of the camera.
- `actions`: A set of helpful functions (`createElement`, `centerContent`, `zoomIn`, `zoomOut`) to control the stage.

You pass the whole context to the `<Stage>` component via the `context` prop.

### Canvas Elements

Elements are just standard SolidJS components. For proper typing, use the `CanvasElementComponent` type. Inside your component, you can use the `useStage()` hook to access the stage context and update state.

```tsx
import { CanvasElementComponent, useStage } from 'solid-infinite-canvas'

const MyElement: CanvasElementComponent = ({ element, elementId }) => {
  // Get access to the stage's setState function
  const { setState } = useStage()

  // Update this element's props when clicked
  const handleClick = () => {
    setState('elements', elementId, 'props', 'someValue', v => v + 1)
  }

  return <div onClick={handleClick}>{element.props.someValue}</div>
}
```

---

## Plugins

Plugins are the primary way to add new features to the stage, like resizing elements or drawing connections between them.

### Using Existing Plugins

The library ships with pre-built plugins. To use them, import the plugin and any components it provides, then add them to the `<Stage>` component.

For example, to add resizing and connection capabilities:

```tsx
import ResizePlugin, { ElementTransformControls } from 'solid-infinite-canvas/plugins/ResizePlugin'
import ConnectionsPlugin, {
  ElementConnectionPoint,
} from 'solid-infinite-canvas/plugins/ConnectionsPlugin'

// In your Stage component:
const App = () => {
  return (
    <Stage
      context={stageContext}
      components={{
        elements: {
          /* your elements */
        },
      }}
      plugins={[ConnectionsPlugin, ResizePlugin]} // <-- Add plugins here
    />
  )
}

// In your element component:
const MyNode: CanvasElementComponent = ({ elementId }) => {
  return (
    <>
      <div class="my-node-body">...</div>

      {/* Add connection points from the ConnectionsPlugin */}
      <ElementConnectionPoint elementId={elementId} type="input" />
      <ElementConnectionPoint elementId={elementId} type="output" />

      {/* Add resize handles from the ResizePlugin */}
      <ElementTransformControls elementId={elementId} />
    </>
  )
}
```

### Building Your Own Plugin

A plugin is an object with a `name`, and optional `events` and `components` properties.

- **`name`**: A unique string identifier for the plugin.
- **`events`**: An object of event handlers (`onMouseDown`, `onWindowMouseMove`, etc.). These handlers receive the `event` and the entire `stage` context, allowing you to react to user input and modify the stage state.
- **`components`**: An object that can contain `viewBack` or `viewFront` components. These are rendered behind or in front of the main elements, respectively. Useful for things like connection lines (in the back) or tooltips (in the front).

Here is a simplified look at the `ConnectionsPlugin` structure:

```ts
import { StagePlugin } from 'solid-infinite-canvas'

const ConnectionsPlugin: StagePlugin = {
  name: 'connections',

  // React to mouse events to create connections
  events: {
    onMouseDown: (event, stage) => {
      const target = event.target as HTMLElement
      // Check if the user clicked on a connection point
      if (target.dataset.connectionPoint) {
        // Logic to start dragging a connection wire...
      }
    },
    onWindowMouseUp: (event, stage) => {
      // Logic to finalize the connection and update state...
      // Plugins can store their own state in stage.state.ext
      stage.setState('ext', 'connectionWires', newId, { from, to })
    },
  },

  // Render the connection wires behind the elements
  components: {
    viewBack: () => {
      const { state } = useStage()
      // Logic to get connection data from state.ext.connectionWires
      // and render SVG paths for each connection.
      return <svg>...</svg>
    },
  },
}
```

### Creating Plugin Components

Plugin components like `ElementConnectionPoint` or `ElementTransformControls` are the interactive parts of a plugin that you place inside your elements.

The key is to use **`data-*` attributes**. The plugin's event handlers use these attributes to identify what the user is interacting with.

Here's the `ElementConnectionPoint` component. Notice how `data-element-id` and `data-connection-point` are used. The `ConnectionsPlugin`'s `onMouseDown` event handler looks for these specific attributes on `event.target` to know that a connection drag has started.

```tsx
import { Component } from 'solid-js'

export const ElementConnectionPoint: Component<{
  elementId: string
  type: 'input' | 'output'
}> = props => {
  return (
    <div
      // These attributes are how the plugin finds this component!
      data-element-id={props.elementId}
      data-connection-point={props.type}
      style={{
        position: 'absolute',
        width: '13px',
        height: '13px',
        background: 'orange',
        'border-radius': '50%',
        left: props.type === 'input' ? '0px' : '100%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
      }}
    />
  )
}
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=./LICENSE) file for details.

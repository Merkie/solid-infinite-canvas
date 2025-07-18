import { createId } from '@paralleldrive/cuid2'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import {
  StagePlugin,
  CanvasElementComponent,
  createStageContext,
  ElementConnectionPoint,
  Stage,
  useStage,
} from 'src'
import ResizePlugin, { ElementTransformControls } from 'src/plugins/ResizePlugin'

const CircleElement: CanvasElementComponent = ({ element, elementId }) => {
  const { setState } = useStage()

  return (
    <>
      <div
        style={{
          'background-color': element.props.color,
          border: '1px solid black',
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          'border-radius': '50%',
          display: 'grid',
          'place-items': 'center',
          'text-align': 'center',
          color: 'white',
          'font-size': '1.5rem',
        }}
        onClick={() => {
          setState('elements', elementId, 'props', 'count', c => (c || 0) + 1)
        }}
      >
        <div
          draggable={false}
          style={{
            'text-shadow': '1px 1px 2px black',
            'pointer-events': 'none',
            'user-select': 'none',
          }}
        >
          {element.props.count}
        </div>
      </div>
      <ElementConnectionPoint elementId={elementId} type="input" />
      <ElementConnectionPoint elementId={elementId} type="output" />
      <ElementTransformControls elementId={elementId} />
    </>
  )
}

const RectangleElement: CanvasElementComponent = ({ element, elementId }) => {
  const { setState } = useStage()
  return (
    <>
      <div
        style={{
          'background-color': element.props.color,
          border: '1px solid black',
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          display: 'grid',
          'place-items': 'center',
          'text-align': 'center',
          color: 'white',
          'font-size': '1.5rem',
        }}
        onClick={() => {
          const colors =
            'red green blue yellow purple orange pink brown gray black white cyan magenta lime teal navy maroon olive silver gold coral salmon turquoise violet indigo crimson orchid plum khaki beige lavender mint peach tan azure chocolate sienna steelblue lightcoral'.split(
              ' ',
            )
          const randomColor = colors[Math.floor(Math.random() * colors.length)]
          setState('elements', elementId, 'props', 'color', randomColor)
        }}
      >
        <div
          draggable={false}
          style={{
            'text-shadow': '1px 1px 2px black',
            'pointer-events': 'none',
            'user-select': 'none',
          }}
        >
          {element.props.color}
        </div>
      </div>
      <ElementConnectionPoint elementId={elementId} type="input" />
      <ElementConnectionPoint elementId={elementId} type="output" />
      <ElementTransformControls elementId={elementId} />
    </>
  )
}

const stagectx = createStageContext()
const { actions } = stagectx

const stagectx2 = createStageContext()
const { actions: actions2 } = stagectx2

type ConnectionWire = {
  id: string
  fromElementId: string
  toElementId: string
}

const ConnectionsPlugin: StagePlugin = {
  name: 'connections',
  events: {
    onMouseDown: (event, stage) => {
      const { setDragStart, state, mousePosition } = stage

      const target = event.target as HTMLElement
      const connectionType = target.dataset.connectionPoint
      const elementIdFromConnection = target.dataset.elementId

      if (connectionType && elementIdFromConnection && state.elements[elementIdFromConnection]) {
        event.stopPropagation()
        setDragStart({
          stageX: mousePosition().x,
          stageY: mousePosition().y,
          target: {
            type: 'connection',
            elementId: elementIdFromConnection,
            ext: { connectionType },
          },
        })
      }
    },
    onWindowMouseUp: (event, stage) => {
      const { state, dragStart, setState } = stage

      const dragStartValue = dragStart()
      if (!dragStartValue) return

      if (dragStartValue.target.type === 'connection') {
        const { elementId: fromElementId } = dragStartValue.target
        const fromType = dragStartValue.target.ext?.connectionType
        const target = event.target as HTMLElement
        const toElementId = target.closest('[data-element-id]')?.getAttribute('data-element-id')
        const toType = target.dataset.connectionPoint
        if (
          toElementId &&
          toType &&
          fromElementId &&
          fromType &&
          fromElementId !== toElementId &&
          fromType !== toType
        ) {
          const newId = createId()
          const from = fromType === 'output' ? fromElementId : toElementId
          const to = fromType === 'input' ? fromElementId : toElementId
          const connectionWires = state.ext.connectionWires || {}
          const alreadyExists = Object.values(connectionWires).some(
            (wire: any) => wire.fromElementId === from && wire.toElementId === to,
          )
          if (!alreadyExists) {
            if (!state.ext.connectionWires) setState('ext', 'connectionWires', {})
            setState('ext', 'connectionWires', newId, {
              id: newId,
              fromElementId: from,
              toElementId: to,
            })
          }
        }
      }
    },
  },
  components: {
    viewBack: () => {
      const { state, dragStart } = useStage()

      return (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            'pointer-events': 'none',
            overflow: 'visible',
          }}
        >
          <For each={Object.values(state.ext.connectionWires || {}) as ConnectionWire[]}>
            {wire => {
              const [fromCoords, setFromCoords] = createSignal<{ x: number; y: number } | null>(
                null,
              )
              const [toCoords, setToCoords] = createSignal<{ x: number; y: number } | null>(null)

              const updateCoords = () => {
                const from = getConnectionPointCoords(wire.fromElementId, 'output')
                const to = getConnectionPointCoords(wire.toElementId, 'input')
                setFromCoords(from)
                setToCoords(to)
              }

              createEffect(() => {
                // Rerun when element positions change
                const fromEl = state.elements[wire.fromElementId]
                const toEl = state.elements[wire.toElementId]
                if (fromEl) {
                  const _f = [fromEl.rect.x, fromEl.rect.y, fromEl.rect.width, fromEl.rect.height]
                }
                if (toEl) {
                  const _t = [toEl.rect.x, toEl.rect.y, toEl.rect.width, toEl.rect.height]
                }
                updateCoords()
              })

              onMount(updateCoords)

              const path = () => {
                const from = fromCoords()
                const to = toCoords()
                if (!from || !to) return ''
                return createDynamicSCurvePath(from.x, from.y, to.x, to.y)
              }
              return <path d={path()} stroke="#64748b" stroke-width="2" fill="none" />
            }}
          </For>

          {/* Render temporary wire while dragging */}
          <Show when={dragStart()?.target.type === 'connection'}>
            <ConnectionCursor />
          </Show>
        </svg>
      )
    },
  },
}

function App() {
  onMount(() => {
    actions.createElement({
      type: 'circle',
      rect: { x: 50, y: 50, width: 100, height: 100 },
      props: { color: 'red', count: 0 },
    })
    actions.createElement({
      type: 'rectangle',
      rect: { x: 400, y: 200, width: 100, height: 100 },
      props: { color: 'blue', count: 0 },
    })

    actions2.createElement({
      type: 'circle',
      rect: { x: 100, y: 100, width: 100, height: 100 },
      props: { color: 'orange', count: 0 },
    })
    actions2.createElement({
      type: 'rectangle',
      rect: { x: 300, y: 300, width: 100, height: 100 },
      props: { color: 'pink', count: 0 },
    })
  })

  function createRandomElement() {
    const types = ['circle', 'rectangle']
    const type = types[Math.floor(Math.random() * types.length)]!
    const x = Math.random() * 700
    const y = Math.random() * 700
    const size = 50 + Math.random() * 100

    actions.createElement({
      type,
      rect: { x, y, width: size, height: size },
      props: {
        color: type === 'circle' ? 'green' : 'purple',
        count: 0,
      },
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '20px',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '500px',
            height: '500px',
            position: 'relative',
          }}
        >
          <Stage
            context={stagectx}
            components={{
              elements: {
                circle: CircleElement,
                rectangle: RectangleElement,
              },
            }}
            plugins={[ConnectionsPlugin, ResizePlugin]}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              display: 'flex',
              'flex-direction': 'column',
            }}
          >
            <button onClick={() => actions.centerContent({ animate: true })}>Center Content</button>
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '10px',
              }}
            >
              <button
                style={{
                  height: 'fit-content',
                }}
                onClick={() => actions.zoomIn()}
              >
                +
              </button>
              <p>{Math.round(stagectx.camera().zoom * 100)}%</p>
              <button
                style={{
                  height: 'fit-content',
                }}
                onClick={() => actions.zoomOut()}
              >
                -
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            width: '500px',
            height: '500px',
            position: 'relative',
          }}
        >
          <Stage
            context={stagectx2}
            components={{
              elements: {
                circle: CircleElement,
                rectangle: RectangleElement,
              },
            }}
            plugins={[ConnectionsPlugin, ResizePlugin]}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              display: 'flex',
              'flex-direction': 'column',
            }}
          >
            <button onClick={() => actions2.centerContent({ animate: true })}>
              Center Content
            </button>
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '10px',
              }}
            >
              <button
                style={{
                  height: 'fit-content',
                }}
                onClick={() => actions2.zoomIn()}
              >
                +
              </button>
              <p>{Math.round(stagectx2.camera().zoom * 100)}%</p>
              <button
                style={{
                  height: 'fit-content',
                }}
                onClick={() => actions2.zoomOut()}
              >
                -
              </button>
            </div>
          </div>
        </div>
      </div>
      <button onClick={createRandomElement}>Create Element</button>
      <pre>{JSON.stringify(stagectx.state, null, 2)}</pre>
    </div>
  )
}

function CustomStageBackground() {
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
        'background-image': `radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px), radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
        'background-color': '#1a1a1a',
      }}
    ></div>
  )
}

export default App

function createDynamicSCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x1 - x2)
  const dy = Math.abs(y1 - y2)

  // Use a horizontal curve if the connection is mostly horizontal
  if (dx > dy) {
    const handleOffset = Math.max(50, dx * 0.4)
    return `M ${x1} ${y1} C ${x1 + handleOffset} ${y1}, ${x2 - handleOffset} ${y2}, ${x2} ${y2}`
  }
  // Otherwise, use a vertical curve
  else {
    const handleOffset = Math.max(50, dy * 0.4)
    return `M ${x1} ${y1} C ${x1} ${y1 + handleOffset}, ${x2} ${y2 - handleOffset}, ${x2} ${y2}`
  }
}

function ConnectionCursor() {
  const { dragStart, mousePosition } = useStage()

  const dragInfo = dragStart()!.target
  const fromCoords = () =>
    getConnectionPointCoords(dragInfo.elementId!, dragInfo.ext?.connectionType!)

  const path = () => {
    const from = fromCoords()
    if (!from) return ''

    const startX = from.x
    const startY = from.y
    const endX = mousePosition().x
    const endY = mousePosition().y

    if (dragInfo.ext?.connectionType === 'output') {
      return createDynamicSCurvePath(startX, startY, endX, endY)
    } else {
      return createDynamicSCurvePath(endX, endY, startX, startY)
    }
  }

  return <path d={path()} stroke="#0ea5e9" stroke-width="2" fill="none" />
}

function getConnectionPointCoords(
  elementId: string,
  type: 'input' | 'output',
): { x: number; y: number } | null {
  const { stageId, camera } = useStage()

  const viewElement = document.querySelector(`[data-view-stage-id="${stageId}"]`)
  if (!viewElement) return null

  // 1. Find the connection point's DOM element using its data attributes.
  const selector = `[data-element-id="${elementId}"] [data-connection-point="${type}"]`
  const pointEl = viewElement.querySelector(selector)
  if (!pointEl) return null

  // 2. Get the screen-space bounding boxes for the view and the point.
  const viewRect = viewElement.getBoundingClientRect()
  const pointRect = pointEl.getBoundingClientRect()

  // 3. Calculate the center of the point in screen space.
  const viewportX = pointRect.left + pointRect.width / 2
  const viewportY = pointRect.top + pointRect.height / 2

  // 4. Convert the screen-space coordinates to the canvas's local "world" space.
  const currentCamera = camera()
  const worldX = (viewportX - viewRect.left) / currentCamera.zoom
  const worldY = (viewportY - viewRect.top) / currentCamera.zoom

  return { x: worldX, y: worldY }
}

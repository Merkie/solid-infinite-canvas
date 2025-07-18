import { createId } from '@paralleldrive/cuid2'
import { createEffect, createSignal, For, onMount, Show } from 'solid-js'
import { StageContextType, StagePlugin, useStage } from 'src'
import { ElementConnectionPoint } from './components/ElementConnectionPoint'

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
    viewBack: ({ stage }: { stage: StageContextType }) => {
      const { state, dragStart } = stage

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
    getConnectionPointCoords(dragInfo.elementId!, dragInfo.ext?.connectionType)

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

export default ConnectionsPlugin
export { ElementConnectionPoint }

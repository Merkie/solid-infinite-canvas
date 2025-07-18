import { createId } from '@paralleldrive/cuid2'
import {
  batch,
  createContext,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  useContext,
  ParentComponent,
  Accessor,
  Setter,
  ValidComponent,
  Component,
  JSX,
  createEffect,
} from 'solid-js'
import { createStore, SetStoreFunction, Store } from 'solid-js/store'
import { Dynamic } from 'solid-js/web'
import gsap from 'gsap'

// --- INLINE STYLES ---

const styles: Record<string, JSX.CSSProperties> = {
  stage: {
    overflow: 'hidden',
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '100%',
    height: '100%',
    'box-sizing': 'border-box',
    outline: 'none',
  },
  view: {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    'transform-origin': '0 0',
  },
  element: {
    position: 'absolute',
    'box-sizing': 'border-box',
  },
  backgroundGrid: {
    'pointer-events': 'none',
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '100%',
    height: '100%',
    'background-color': '#ffffff',
    'background-image':
      'linear-gradient(#eeeeee 1px, transparent 1px), linear-gradient(90deg, #eeeeee 1px, transparent 1px)',
  },
  selectionBox: {
    border: '1px solid #0ea5e9',
    'background-color': 'rgba(14, 165, 233, 0.1)',
    position: 'absolute',
    'z-index': 9999,
    'box-sizing': 'border-box',
    'transform-origin': '0 0',
  },
  transformControls: {
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '100%',
    height: '100%',
    'pointer-events': 'none',
    border: '1px solid #0ea5e9',
    'box-sizing': 'border-box',
  },
  resizeHandle: {
    position: 'absolute',
    border: '1px solid #0ea5e9',
    'background-color': 'white',
    height: '8px',
    width: '8px',
    'pointer-events': 'all',
    'box-sizing': 'border-box',
    'z-index': 10000,
  },
  resizeHandleTopLeft: {
    top: '0px',
    left: '0px',
    transform: 'translate(-50%, -50%)',
    cursor: 'nwse-resize',
  },
  resizeHandleTopRight: {
    top: '0px',
    right: '0px',
    transform: 'translate(50%, -50%)',
    cursor: 'nesw-resize',
  },
  resizeHandleBottomLeft: {
    bottom: '0px',
    left: '0px',
    transform: 'translate(-50%, 50%)',
    cursor: 'nesw-resize',
  },
  resizeHandleBottomRight: {
    bottom: '0px',
    right: '0px',
    transform: 'translate(50%, 50%)',
    cursor: 'nwse-resize',
  },
}

// --- STATE AND TYPE DEFINITIONS ---

type ElementState = {
  type: string
  rect: { x: number; y: number; width: number; height: number; zIndex: number }
  props: Record<string, any>
}

type ConnectionWire = {
  id: string
  fromElementId: string
  toElementId: string
}

type UncreatedElementState = Omit<ElementState, 'rect'> & {
  rect: Omit<ElementState['rect'], 'zIndex'>
}

type StageState = {
  elements: Record<string, ElementState>
  connectionWires: Record<string, ConnectionWire>
  cursors: Record<string, { x: number; y: number }>
  selectionBoxes: Record<
    string,
    { x: number; y: number; width: number; height: number; hidden: boolean }
  >
  selectedElements: Record<string, string[]>
}

type DragTarget = {
  type: string
  initialRects?: Map<string, ElementState['rect']>
  elementId?: string
  connectionType?: 'input' | 'output'
  resizeDir?: string
  initialRect?: ElementState['rect']
}

type RenderableElements = Record<string, ValidComponent>

// --- CONTEXT FOR STATE ENCAPSULATION ---

type StageActions = {
  createElement: (args: UncreatedElementState) => string
  centerContent: (options?: { animate?: boolean; margin?: number }) => void
  zoomIn: () => void
  zoomOut: () => void
}

type StageContextType = {
  state: Store<StageState>
  setState: SetStoreFunction<StageState>
  clientId: string
  camera: Accessor<{ x: number; y: number; zoom: number }>
  setCamera: Setter<{ x: number; y: number; zoom: number }>
  mousePosition: Accessor<{ x: number; y: number }>
  setMousePosition: Setter<{ x: number; y: number }>
  dragStart: Accessor<{ stageX: number; stageY: number; target: DragTarget } | undefined>
  setDragStart: Setter<{ stageX: number; stageY: number; target: DragTarget } | undefined>
  panning: Accessor<boolean>
  setPanning: Setter<boolean>
  containerSize: Accessor<{ width: number; height: number }>
  setContainerSize: Setter<{ width: number; height: number }>
  actions: StageActions
}

type StageContextWithoutActions = Omit<StageContextType, 'actions'>

export type ElementRendererComponent = Component<{
  elementId: string
  renderableElements: RenderableElements
}>

export type CanvasElementComponent = Component<{
  elementId: string
  element: ElementState
}>

const StageContext = createContext<StageContextType>()

type CreateStageContext = () => StageContextType

type ElementType = string
type StageComponents = {
  elements: Record<ElementType, CanvasElementComponent>
  background?: ValidComponent
}

type CreateStageActions = (stage: StageContextWithoutActions) => StageActions

// --- UTILITY FUNCTIONS ---
/**
 * Creates an SVG path string for an S-shaped curve, dynamically choosing
 * between a horizontal or vertical orientation for the best look.
 */
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

const createStageActions: CreateStageActions = (stage: StageContextWithoutActions) => {
  const createElement: StageActions['createElement'] = element => {
    const id = createId()
    stage.setState('elements', id, {
      type: element.type,
      props: element.props,
      rect: { ...element.rect, zIndex: 1 },
    })

    return id
  }

  const centerContent: StageActions['centerContent'] = options => {
    const elements = Object.values(stage.state.elements)
    if (elements.length === 0) return
    const margin = options?.margin || 50
    const minX = Math.min(...elements.map(el => el.rect.x))
    const minY = Math.min(...elements.map(el => el.rect.y))
    const maxX = Math.max(...elements.map(el => el.rect.x + el.rect.width))
    const maxY = Math.max(...elements.map(el => el.rect.y + el.rect.height))
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    if (contentWidth === 0 || contentHeight === 0) return
    const zoomX = (stage.containerSize().width - margin * 2) / contentWidth
    const zoomY = (stage.containerSize().height - margin * 2) / contentHeight
    const newZoom = Math.min(zoomX, zoomY)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const newCamera = {
      x: stage.containerSize().width / 2 - centerX * newZoom,
      y: stage.containerSize().height / 2 - centerY * newZoom,
      zoom: newZoom,
    }
    const currentCamera = stage.camera()
    if (!options?.animate) {
      stage.setCamera(newCamera)
    } else {
      gsap.killTweensOf(currentCamera)
      gsap.to(currentCamera, {
        duration: 0.2,
        ease: 'power2.out',
        x: newCamera.x,
        y: newCamera.y,
        zoom: newCamera.zoom,
        onUpdate: () => {
          stage.setCamera({
            x: currentCamera.x,
            y: currentCamera.y,
            zoom: currentCamera.zoom,
          })
        },
      })
    }
  }

  const zoomIn = () => {
    const currentCamera = stage.camera()
    const newZoom = Math.min(currentCamera.zoom * 1.2, 10)
    const centerX = stage.containerSize().width / 2
    const centerY = stage.containerSize().height / 2

    const newCamera = {
      x: centerX - (centerX - currentCamera.x) * (newZoom / currentCamera.zoom),
      y: centerY - (centerY - currentCamera.y) * (newZoom / currentCamera.zoom),
      zoom: newZoom,
    }
    gsap.killTweensOf(currentCamera)
    gsap.to(currentCamera, {
      duration: 0.2,
      ease: 'power2.out',
      x: newCamera.x,
      y: newCamera.y,
      zoom: newCamera.zoom,
      onUpdate: () => {
        stage.setCamera({
          x: currentCamera.x,
          y: currentCamera.y,
          zoom: currentCamera.zoom,
        })
      },
    })
  }

  const zoomOut = () => {
    const currentCamera = stage.camera()
    const newZoom = Math.max(currentCamera.zoom / 1.2, 0.1)
    const centerX = stage.containerSize().width / 2
    const centerY = stage.containerSize().height / 2

    const newCamera = {
      x: centerX - (centerX - currentCamera.x) * (newZoom / currentCamera.zoom),
      y: centerY - (centerY - currentCamera.y) * (newZoom / currentCamera.zoom),
      zoom: newZoom,
    }
    gsap.killTweensOf(currentCamera)
    gsap.to(currentCamera, {
      duration: 0.2,
      ease: 'power2.out',
      x: newCamera.x,
      y: newCamera.y,
      zoom: newCamera.zoom,
      onUpdate: () => {
        stage.setCamera({
          x: currentCamera.x,
          y: currentCamera.y,
          zoom: currentCamera.zoom,
        })
      },
    })
  }

  return {
    createElement,
    centerContent,
    zoomIn,
    zoomOut,
  }
}

export const createStageContext: CreateStageContext = () => {
  const [state, setState] = createStore<StageState>({
    elements: {},
    connectionWires: {},
    cursors: {},
    selectionBoxes: {},
    selectedElements: {},
  })

  const clientId = createId()
  const [camera, setCamera] = createSignal({ x: 0, y: 0, zoom: 1 })
  const [mousePosition, setMousePosition] = createSignal({ x: 0, y: 0 })
  const [dragStart, setDragStart] = createSignal<
    { stageX: number; stageY: number; target: DragTarget } | undefined
  >(undefined)
  const [panning, setPanning] = createSignal(false)
  const [containerSize, setContainerSize] = createSignal({ width: 0, height: 0 })

  const stage: StageContextWithoutActions = {
    state,
    setState,
    clientId,
    camera,
    setCamera,
    mousePosition,
    setMousePosition,
    dragStart,
    setDragStart,
    panning,
    setPanning,
    containerSize,
    setContainerSize,
  }

  const actions = createStageActions(stage)

  return {
    ...stage,
    actions,
  }
}

const StageProvider: ParentComponent<{
  context: StageContextType
}> = props => {
  return <StageContext.Provider value={props.context}>{props.children}</StageContext.Provider>
}

export const useStage = () => {
  const context = useContext(StageContext)
  if (!context) {
    throw new Error('useStage must be used within a StageProvider')
  }
  return context
}

// --- STAGE COMPONENT ---

export const Stage: Component<{
  context: StageContextType
  components: StageComponents
}> = props => {
  return (
    <StageProvider context={props.context}>
      <StageCanvas components={props.components} />
    </StageProvider>
  )
}

function StageCanvas(props: { components: StageComponents }) {
  const {
    state,
    setState,
    clientId,
    camera,
    setCamera,
    setMousePosition,
    dragStart,
    setDragStart,
    panning,
    setPanning,
    setContainerSize,
    actions,
  } = useStage()

  let stageRef: HTMLDivElement | undefined
  let viewRef: HTMLDivElement | undefined

  /**
   * Finds a connection point's DOM element and converts its on-screen
   * position to the canvas's local "world" coordinates.
   */
  function getConnectionPointCoords(
    elementId: string,
    type: 'input' | 'output',
  ): { x: number; y: number } | null {
    if (!viewRef) return null

    // 1. Find the connection point's DOM element using its data attributes.
    const selector = `[data-element-id="${elementId}"] [data-connection-point="${type}"]`
    const pointEl = viewRef.querySelector(selector)
    if (!pointEl) return null

    // 2. Get the screen-space bounding boxes for the view and the point.
    const viewRect = viewRef.getBoundingClientRect()
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

  const getStageCoordinates = (event: MouseEvent) => {
    if (!stageRef) return { x: 0, y: 0 }
    const rect = stageRef.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function getResizeCursor(resizeDir: string | undefined) {
    if (!resizeDir) return 'default'
    if (resizeDir === 'top left' || resizeDir === 'bottom right') return 'nwse-resize'
    if (resizeDir === 'top right' || resizeDir === 'bottom left') return 'nesw-resize'
    return 'default'
  }

  function onMouseDown(event: MouseEvent) {
    const { x: stageX, y: stageY } = getStageCoordinates(event)

    if (event.button === 1 || (event.button === 0 && panning())) {
      event.preventDefault()
      setPanning(true)
    }

    const target = event.target as HTMLElement
    const elementDiv = target.closest('[data-element-id]') as unknown as HTMLElement | null
    const elementIdAttr = elementDiv?.dataset.elementId
    const resizeDir = target.dataset.resizeDir
    const connectionType = target.dataset.connectionPoint as 'input' | 'output' | undefined

    if (connectionType && elementIdAttr && state.elements[elementIdAttr]) {
      event.stopPropagation()
      setDragStart({
        stageX,
        stageY,
        target: {
          type: 'connection',
          elementId: elementIdAttr,
          connectionType: connectionType,
        },
      })
    } else if (resizeDir && elementIdAttr && state.elements[elementIdAttr]) {
      event.stopPropagation()
      setDragStart({
        stageX,
        stageY,
        target: {
          type: 'resize',
          elementId: elementIdAttr,
          resizeDir,
          initialRect: { ...state.elements[elementIdAttr].rect },
        },
      })
    } else if (elementIdAttr && state.elements[elementIdAttr]) {
      batch(() => {
        if (!state.selectedElements[clientId]?.includes(elementIdAttr)) {
          setState('selectedElements', clientId, [elementIdAttr])
          const maxZ = Math.max(0, ...Object.values(state.elements).map(el => el.rect.zIndex))
          setState('elements', elementIdAttr, 'rect', 'zIndex', maxZ + 1)
        }

        const initialRects = new Map<string, ElementState['rect']>()
        for (const id of state.selectedElements[clientId]!) {
          if (state.elements[id]) initialRects.set(id, { ...state.elements[id].rect })
        }

        setDragStart({
          stageX,
          stageY,
          target: { type: 'elements', initialRects },
        })
      })
    } else {
      setState('selectedElements', clientId, [])
      setDragStart({ stageX, stageY, target: { type: 'stage' } })
    }

    if (dragStart()) {
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('mouseup', onWindowMouseUp)
    }
  }

  function onMouseMove(event: MouseEvent) {
    const { x: stageX, y: stageY } = getStageCoordinates(event)
    setMousePosition({ x: stageX, y: stageY })
    if (dragStart()) return
    const currentCamera = camera()
    const worldX = (stageX - currentCamera.x) / currentCamera.zoom
    const worldY = (stageY - currentCamera.y) / currentCamera.zoom
    setState('cursors', clientId, { x: worldX, y: worldY })
  }

  function onWindowMouseMove(event: MouseEvent) {
    const dragStartValue = dragStart()
    if (!dragStartValue) return

    const { x: stageX, y: stageY } = getStageCoordinates(event)
    const currentCamera = camera()

    if (panning()) {
      setCamera(prev => ({
        ...prev,
        x: prev.x + event.movementX,
        y: prev.y + event.movementY,
      }))
      return
    }

    const worldX = (stageX - currentCamera.x) / currentCamera.zoom
    const worldY = (stageY - currentCamera.y) / currentCamera.zoom
    setState('cursors', clientId, { x: worldX, y: worldY })

    const dx = (stageX - dragStartValue.stageX) / currentCamera.zoom
    const dy = (stageY - dragStartValue.stageY) / currentCamera.zoom

    if (dragStartValue.target.type === 'resize') {
      const { elementId, resizeDir, initialRect } = dragStartValue.target
      if (!elementId || !resizeDir || !initialRect) return
      let { x, y, width, height } = initialRect

      const MIN_SIZE = 20 / currentCamera.zoom

      if (resizeDir.includes('right')) width = Math.max(MIN_SIZE, initialRect.width + dx)
      if (resizeDir.includes('left')) width = Math.max(MIN_SIZE, initialRect.width - dx)
      if (resizeDir.includes('bottom')) height = Math.max(MIN_SIZE, initialRect.height + dy)
      if (resizeDir.includes('top')) height = Math.max(MIN_SIZE, initialRect.height - dy)

      if (event.shiftKey) {
        const aspectRatio = initialRect.width / initialRect.height
        if (Math.abs(dx) > Math.abs(dy)) {
          height = width / aspectRatio
        } else {
          width = height * aspectRatio
        }
      }

      if (resizeDir.includes('left')) x = initialRect.x + initialRect.width - width
      if (resizeDir.includes('top')) y = initialRect.y + initialRect.height - height

      setState('elements', elementId, 'rect', prev => ({
        ...prev,
        x,
        y,
        width,
        height,
      }))
    } else if (dragStartValue.target.type === 'elements') {
      batch(() => {
        for (const [id, initialRect] of dragStartValue.target.initialRects!.entries()) {
          setState('elements', id, 'rect', prev => ({
            ...prev,
            x: initialRect.x + dx,
            y: initialRect.y + dy,
          }))
        }
      })
    } else if (dragStartValue.target.type === 'stage') {
      const startWorldX = (dragStartValue.stageX - currentCamera.x) / currentCamera.zoom
      const startWorldY = (dragStartValue.stageY - currentCamera.y) / currentCamera.zoom
      setState('selectionBoxes', clientId, {
        x: Math.min(startWorldX, worldX),
        y: Math.min(startWorldY, worldY),
        width: Math.abs(worldX - startWorldX),
        height: Math.abs(worldY - startWorldY),
        hidden: false,
      })
    }
  }

  function onWindowMouseUp(event: MouseEvent) {
    if (event.button === 1 || panning()) setPanning(false)

    const dragStartValue = dragStart()

    if (dragStartValue?.target.type === 'connection') {
      const { elementId: fromElementId, connectionType: fromType } = dragStartValue.target
      const target = event.target as HTMLElement
      const toElementId = target.closest('[data-element-id]')?.getAttribute('data-element-id')
      const toType = target.dataset.connectionPoint as 'input' | 'output' | undefined

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

        const alreadyExists = Object.values(state.connectionWires).some(
          wire => wire.fromElementId === from && wire.toElementId === to,
        )

        if (!alreadyExists) {
          setState('connectionWires', newId, {
            id: newId,
            fromElementId: from,
            toElementId: to,
          })
        }
      }
    }

    const selectionBox = state.selectionBoxes[clientId]
    if (dragStart()?.target.type === 'stage' && selectionBox && !selectionBox.hidden) {
      const selected = Object.entries(state.elements)
        .filter(([_, el]) => {
          const rect = el.rect
          return (
            rect.x < selectionBox.x + selectionBox.width &&
            rect.x + rect.width > selectionBox.x &&
            rect.y < selectionBox.y + selectionBox.height &&
            rect.y + rect.height > selectionBox.y
          )
        })
        .map(([id]) => id)
      setState('selectedElements', clientId, selected)
      setState('selectionBoxes', clientId, 'hidden', true)
    }

    setDragStart(undefined)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    setCamera(prev => ({
      ...prev,
      x: prev.x - event.deltaX,
      y: prev.y - event.deltaY,
    }))
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === ' ' && !panning() && !dragStart()) {
      event.preventDefault()
      setPanning(true)
    }
    if ((event.metaKey || event.ctrlKey) && (event.key === '=' || event.key === '-')) {
      event.preventDefault()
      if (event.key === '=') {
        actions.zoomIn()
      } else {
        actions.zoomOut()
      }
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key === ' ') setPanning(false)
  }

  onMount(() => {
    if (!stageRef) return
    setContainerSize({
      width: stageRef.clientWidth,
      height: stageRef.clientHeight,
    })
    stageRef.addEventListener('mousedown', onMouseDown)
    stageRef.addEventListener('mousemove', onMouseMove)
    stageRef.addEventListener('keydown', onKeyDown)
    stageRef.addEventListener('keyup', onKeyUp)
    stageRef.addEventListener('wheel', onWheel, { passive: false })
  })

  onCleanup(() => {
    if (!stageRef) return
    stageRef.removeEventListener('mousedown', onMouseDown)
    stageRef.removeEventListener('mousemove', onMouseMove)
    stageRef.removeEventListener('keydown', onKeyDown)
    stageRef.removeEventListener('keyup', onKeyUp)
    stageRef.removeEventListener('wheel', onWheel)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  })

  return (
    <main
      ref={stageRef}
      tabIndex={0}
      style={{
        ...styles.stage,
        cursor:
          dragStart()?.target.type === 'resize'
            ? getResizeCursor(dragStart()?.target.resizeDir)
            : panning()
            ? 'grabbing'
            : dragStart()?.target.type === 'connection'
            ? 'crosshair'
            : 'default',
      }}
    >
      <Dynamic component={props.components.background ?? StageBackground} />
      <div
        ref={viewRef}
        style={{
          ...styles.view,
          transform: `translate(${camera().x}px, ${camera().y}px) scale(${camera().zoom})`,
        }}
      >
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
          {/* Render permanent connection wires */}
          <For each={Object.values(state.connectionWires)}>
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
                // values I want to listen for changes on
                const _ = [
                  state.elements[wire.fromElementId]?.rect.x,
                  state.elements[wire.fromElementId]?.rect.y,
                  state.elements[wire.toElementId]?.rect.x,
                  state.elements[wire.toElementId]?.rect.y,
                ]

                // function that I want to run when the values change
                updateCoords()
              })

              onMount(() => {
                updateCoords()
              })

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
            <ConnectionCursor getConnectionPointCoords={getConnectionPointCoords} />
          </Show>
        </svg>

        <For each={Object.entries(state.elements)}>
          {([id, element]) => (
            <div
              data-element-id={id}
              style={{
                ...styles.element,
                'z-index': element.rect.zIndex,
                transform: `translate(${element.rect.x}px, ${element.rect.y}px)`,
                width: `${element.rect.width}px`,
                height: `${element.rect.height}px`,
                'pointer-events':
                  state.selectionBoxes[clientId]?.hidden === false ? 'none' : 'auto',
              }}
            >
              <Dynamic
                component={ElementRenderer}
                elementId={id}
                renderableElements={props.components.elements}
              />
            </div>
          )}
        </For>
        <For each={Object.entries(state.selectionBoxes)}>
          {([ownerId, box]) => (
            <Show when={ownerId === clientId}>
              <div
                style={{
                  ...styles.selectionBox,
                  width: `${box.width}px`,
                  height: `${box.height}px`,
                  display: box.hidden ? 'none' : 'block',
                  left: `${box.x}px`,
                  top: `${box.y}px`,
                }}
              />
            </Show>
          )}
        </For>
      </div>
    </main>
  )
}

function ConnectionCursor({
  getConnectionPointCoords,
}: {
  getConnectionPointCoords: (
    elementId: string,
    type: 'input' | 'output',
  ) => { x: number; y: number } | null
}) {
  const { dragStart, camera, mousePosition } = useStage()

  const dragInfo = dragStart()!.target
  const currentCamera = camera()
  const fromCoords = () => getConnectionPointCoords(dragInfo.elementId!, dragInfo.connectionType!)
  const worldMouseX = () => (mousePosition().x - currentCamera.x) / currentCamera.zoom
  const worldMouseY = () => (mousePosition().y - currentCamera.y) / currentCamera.zoom

  const path = () => {
    const from = fromCoords()
    if (!from) return ''

    const startX = from.x
    const startY = from.y
    const endX = worldMouseX()
    const endY = worldMouseY()

    if (dragInfo.connectionType === 'output') {
      return createDynamicSCurvePath(startX, startY, endX, endY)
    } else {
      return createDynamicSCurvePath(endX, endY, startX, startY)
    }
  }
  return <path d={path()} stroke="#0ea5e9" stroke-width="2" fill="none" />
}

function StageBackground() {
  const { camera } = useStage()
  return (
    <div
      style={{
        ...styles.backgroundGrid,
        'background-position': `${camera().x}px ${camera().y}px`,
        'background-size': `${40 * camera().zoom}px ${40 * camera().zoom}px`,
      }}
    ></div>
  )
}

const ElementRenderer: ElementRendererComponent = props => {
  const { state } = useStage()
  const element = state.elements[props.elementId]

  return (
    <Show when={element}>
      <For each={Object.entries(props.renderableElements)}>
        {([type, el]) => (
          <Show when={element?.type === type}>
            <Dynamic component={el} elementId={props.elementId} element={element} />
          </Show>
        )}
      </For>
    </Show>
  )
}

export const ElementTransformControls: Component<{ elementId: string }> = props => {
  const { state, clientId } = useStage()
  return (
    <Show when={state.selectedElements[clientId]?.includes(props.elementId)}>
      <div style={styles.transformControls}>
        <div
          data-element-id={props.elementId}
          data-resize-dir="top left"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleTopLeft }}
        />
        <div
          data-element-id={props.elementId}
          data-resize-dir="top right"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleTopRight }}
        />
        <div
          data-element-id={props.elementId}
          data-resize-dir="bottom left"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleBottomLeft }}
        />
        <div
          data-element-id={props.elementId}
          data-resize-dir="bottom right"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleBottomRight }}
        />
      </div>
    </Show>
  )
}

export const ElementConnectionPoint: Component<{
  elementId: string
  type: 'input' | 'output'
}> = props => {
  const { state } = useStage()
  const element = state.elements[props.elementId]

  return (
    <Show when={element}>
      <div
        data-element-id={props.elementId}
        data-connection-point={props.type}
        style={{
          position: 'absolute',
          width: '13px',
          height: '13px',
          'background-color': props.type === 'input' ? 'orange' : 'blue',
          'border-radius': '50%',
          left: props.type === 'input' ? '0px' : '100%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2px solid black',
          'box-sizing': 'border-box',
          'pointer-events': 'all',
          cursor: 'pointer',
        }}
      />
    </Show>
  )
}

export function createInitialState(elements: UncreatedElementState[]) {
  const initialState = elements.reduce(
    (acc, el) => {
      acc[createId()] = {
        ...el,
        rect: { ...el.rect, zIndex: 1 },
      }
      return acc
    },
    {} as Record<string, ElementState>,
  )

  return { elements: initialState, connectionWires: {} }
}

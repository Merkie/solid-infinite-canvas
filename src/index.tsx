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

// NEW: Type for a connection wire
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
  // NEW: State for connection wires
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
  // NEW: Property to identify connection drag type
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
 * Creates an SVG path string for an S-shaped curve.
 * @param x1 - Start X coordinate
 * @param y1 - Start Y coordinate
 * @param x2 - End X coordinate
 * @param y2 - End Y coordinate
 * @returns The SVG path data string.
 */
function createSCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const horizontalDistance = Math.abs(x1 - x2)
  const handleOffset = Math.max(50, horizontalDistance * 0.4)
  return `M ${x1} ${y1} C ${x1 + handleOffset} ${y1}, ${x2 - handleOffset} ${y2}, ${x2} ${y2}`
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

    // 1. Define your desired padding
    const margin = options?.margin || 50

    // 2. Find the bounding box of all elements
    const minX = Math.min(...elements.map(el => el.rect.x))
    const minY = Math.min(...elements.map(el => el.rect.y))
    const maxX = Math.max(...elements.map(el => el.rect.x + el.rect.width))
    const maxY = Math.max(...elements.map(el => el.rect.y + el.rect.height))

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Handle case where content has no size to prevent division by zero
    if (contentWidth === 0 || contentHeight === 0) return

    // 3. Calculate the required zoom level to fit the content
    const zoomX = (stage.containerSize().width - margin * 2) / contentWidth
    const zoomY = (stage.containerSize().height - margin * 2) / contentHeight

    // Use the smaller zoom level to ensure everything fits on the screen
    const newZoom = Math.min(zoomX, zoomY)

    // 4. Calculate the center of the content
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // 5. Center the view, adjusting the camera's position for the new zoom level
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
    // NEW: Initialize connectionWires
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

function getConnectionPointCoords(
  elementId: string,
  type: 'input' | 'output',
): { x: number; y: number } | null {
  const { state } = useStage()

  const element = state.elements[elementId]
  if (!element) return null

  const x = element.rect.x + (type === 'input' ? 0 : element.rect.width)
  const y = element.rect.y + element.rect.height / 2

  return { x, y }
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
  } = useStage()

  let stageRef: HTMLDivElement | undefined
  let viewRef: HTMLDivElement | undefined

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

  // NEW: Helper to get world coordinates of a connection point

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
    // NEW: Check for connection point clicks
    const connectionType = target.dataset.connectionPoint as 'input' | 'output' | undefined

    // Case 0: A connection point was clicked
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
      // Case 1: A resize handle was clicked
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
      // Case 2: An element itself was clicked
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
      // Case 3: The background was clicked
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

    // No changes needed here for connections, handled by reactive rendering
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

    // NEW: Logic for finishing a connection
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
        fromElementId !== toElementId && // Can't connect to self
        fromType !== toType // Must be opposite types
      ) {
        const newId = createId()
        // Standardize: 'from' is always output, 'to' is always input
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

  function handleZoom(delta: number, stageX: number, stageY: number) {
    const currentCamera = camera()
    const targetZoom = Math.max(0.1, Math.min(currentCamera.zoom * delta, 10))

    if (targetZoom === currentCamera.zoom) return

    gsap.killTweensOf(currentCamera)

    const mouseWorldX = (stageX - currentCamera.x) / currentCamera.zoom
    const mouseWorldY = (stageY - currentCamera.y) / currentCamera.zoom
    const targetX = stageX - mouseWorldX * targetZoom
    const targetY = stageY - mouseWorldY * targetZoom

    gsap.to(currentCamera, {
      duration: 0.2,
      ease: 'power2.out',
      x: targetX,
      y: targetY,
      zoom: targetZoom,
      onUpdate: () => {
        setCamera({
          x: currentCamera.x,
          y: currentCamera.y,
          zoom: currentCamera.zoom,
        })
      },
    })
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()

    if (event.ctrlKey || event.metaKey) {
      const zoomFactor = event.deltaY > 0 ? 1 / 1.1 : 1.1
      const { x, y } = getStageCoordinates(event)
      handleZoom(zoomFactor, x, y)
    } else {
      setCamera(prev => ({
        ...prev,
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }))
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === ' ' && !panning() && !dragStart()) {
      event.preventDefault()
      setPanning(true)
    }

    if ((event.metaKey || event.ctrlKey) && (event.key === '=' || event.key === '-')) {
      event.preventDefault()
      const zoomDirection = event.key === '=' ? 1.2 : 1 / 1.2
      const centerOfStage = {
        x: stageRef!.clientWidth / 2,
        y: stageRef!.clientHeight / 2,
      }
      handleZoom(zoomDirection, centerOfStage.x, centerOfStage.y)
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
          {/* NEW: Render permanent connection wires */}
          <For each={Object.values(state.connectionWires)}>
            {wire => {
              const fromCoords = () => getConnectionPointCoords(wire.fromElementId, 'output')
              const toCoords = () => getConnectionPointCoords(wire.toElementId, 'input')
              const path = () => {
                const from = fromCoords()
                const to = toCoords()
                if (!from || !to) return ''
                return createSCurvePath(from.x, from.y, to.x, to.y)
              }
              return <path d={path()} stroke="#64748b" stroke-width="2" fill="none" />
            }}
          </For>

          {/* NEW: Render temporary wire while dragging */}
          <Show when={dragStart()?.target.type === 'connection'}>
            <ConnectionWireCursor />
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

function ConnectionWireCursor() {
  const { dragStart, mousePosition, camera } = useStage()

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
      return createSCurvePath(startX, startY, endX, endY)
    } else {
      return createSCurvePath(endX, endY, startX, startY)
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
          top: '50%',
          left: props.type === 'input' ? '0px' : '100%',
          transform: 'translateY(-50%) translateX(-50%)',
          border: '2px solid black',
          'box-sizing': 'border-box',
          // NEW: Ensure connection points are always clickable
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

  // NEW: Include connectionWires in the initial state object
  return { elements: initialState, connectionWires: {} }
}

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
    position: 'relative',
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

type UncreatedElementState = Omit<ElementState, 'rect'> & {
  rect: Omit<ElementState['rect'], 'zIndex'>
}

type StageState = {
  elements: Record<string, ElementState>
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
  resizeDir?: string
  initialRect?: ElementState['rect']
}

type RenderableElements = Record<string, ValidComponent>

// --- CONTEXT FOR STATE ENCAPSULATION ---

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
  createElement: (args: UncreatedElementState) => string
}

export type ElementRendererComponent = Component<{
  elementId: string
  renderableElements: RenderableElements
}>

export type CanvasElementComponent = Component<{
  elementId: string
  element: ElementState
}>

const StageContext = createContext<StageContextType>()

type CreateStageContextType = () => StageContextType

type ElementType = string
type StageComponents = {
  elements: Record<ElementType, CanvasElementComponent>
  background?: ValidComponent
}

export const createStageContext: CreateStageContextType = () => {
  const [state, setState] = createStore<StageState>({
    elements: {},
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

  const createElement: StageContextType['createElement'] = element => {
    const id = createId()
    setState('elements', id, {
      type: element.type,
      props: element.props,
      rect: { ...element.rect, zIndex: 1 },
    })

    return id
  }

  const stage: StageContextType = {
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
    createElement,
  }

  return stage
}

const StageProvider: ParentComponent<{
  stage: StageContextType
}> = props => {
  return <StageContext.Provider value={props.stage}>{props.children}</StageContext.Provider>
}

export const useStage = () => {
  const context = useContext(StageContext)
  if (!context) {
    throw new Error('useStage must be used within a StageProvider')
  }
  return context
}

// --- STAGE COMPONENT ---

export const Stage: ParentComponent<{
  stage: StageContextType
  components: StageComponents
  class?: string
  style?: JSX.CSSProperties
}> = props => {
  return (
    <StageProvider stage={props.stage}>
      <StageCanvas components={props.components} class={props.class} style={props.style} />
      {props.children}
    </StageProvider>
  )
}

function StageCanvas(props: {
  components: StageComponents
  class?: string
  style?: JSX.CSSProperties
}) {
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

    // Case 1: A resize handle was clicked
    if (resizeDir && elementIdAttr && state.elements[elementIdAttr]) {
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
      class={props.class}
      style={{
        ...styles.stage,
        ...props.style,
        cursor:
          dragStart()?.target.type === 'resize'
            ? getResizeCursor(dragStart()?.target.resizeDir)
            : panning()
            ? 'grabbing'
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

  return { elements: initialState }
}

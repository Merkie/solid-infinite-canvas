import { createId } from '@paralleldrive/cuid2'
import {
  batch,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  Accessor,
  Setter,
  ValidComponent,
  Component,
} from 'solid-js'
import { createStore, SetStoreFunction, Store } from 'solid-js/store'
import { Dynamic } from 'solid-js/web'
import gsap from 'gsap'
import styles from './styles'

// --- INLINE STYLES ---

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
  ext: Record<string, Record<string, any>>
}

type DragTarget = {
  type: string
  initialRects?: Map<string, ElementState['rect']>
  elementId?: string
  ext?: Record<string, any>
}

type RenderableElements = Record<string, ValidComponent>

// --- CONTEXT FOR STATE ENCAPSULATION ---

type StageActions = {
  createElement: (args: UncreatedElementState) => string
  centerContent: (options?: { animate?: boolean; margin?: number }) => void
  zoomIn: () => void
  zoomOut: () => void
}

export type StageContextType = {
  stageId: string
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
  stage: StageContextType
  elementId: string
  renderableElements: RenderableElements
}>

export type CanvasElementComponent = Component<{
  stage: StageContextType
  elementId: string
  element: ElementState
  isSelected: () => boolean
}>

type CreateStageContext = () => StageContextType

type ElementType = string
type StageComponents = {
  elements: Record<ElementType, CanvasElementComponent>
  background?: ValidComponent
}

type CreateStageActions = (stage: StageContextWithoutActions) => StageActions

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
    cursors: {},
    selectionBoxes: {},
    selectedElements: {},
    ext: {},
  })

  const clientId = createId()
  const stageId = createId()
  const [camera, setCamera] = createSignal({ x: 0, y: 0, zoom: 1 })
  const [mousePosition, setMousePosition] = createSignal({ x: 0, y: 0 })
  const [dragStart, setDragStart] = createSignal<
    { stageX: number; stageY: number; target: DragTarget } | undefined
  >(undefined)
  const [panning, setPanning] = createSignal(false)
  const [containerSize, setContainerSize] = createSignal({ width: 0, height: 0 })

  const stage: StageContextWithoutActions = {
    stageId,
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

// --- STAGE COMPONENT ---

export type StagePlugin = {
  name: string
  components?: {
    viewFront?: ValidComponent
    viewBack?: ValidComponent
  }
  events?: {
    onMouseDown?: (event: MouseEvent, stage: StageContextType) => void
    onWindowMouseMove?: (event: MouseEvent, stage: StageContextType) => void
    onWindowMouseUp?: (event: MouseEvent, stage: StageContextType) => void
    onKeyDown?: (event: KeyboardEvent, stage: StageContextType) => void
    onKeyUp?: (event: KeyboardEvent, stage: StageContextType) => void
    onWheel?: (event: WheelEvent, stage: StageContextType) => void
  }
}

export const Stage: Component<{
  context: StageContextType
  components: StageComponents
  plugins?: (StagePlugin | StagePlugin[])[]
}> = props => {
  return (
    <StageCanvas
      components={props.components}
      plugins={(props.plugins || []).flat()}
      stage={props.context}
    />
  )
}

function StageCanvas(props: {
  components: StageComponents
  plugins: StagePlugin[]
  stage: StageContextType
}) {
  const stage = props.stage
  const {
    stageId,
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
  } = stage

  let stageRef: HTMLDivElement | undefined

  function onMouseDown(event: MouseEvent) {
    if (!stageRef) return
    // --- 1. Correctly calculate world coordinates on mousedown ---
    const rect = stageRef.getBoundingClientRect()
    const currentCamera = camera()
    const worldX = (event.clientX - rect.left - currentCamera.x) / currentCamera.zoom
    const worldY = (event.clientY - rect.top - currentCamera.y) / currentCamera.zoom
    setMousePosition({ x: worldX, y: worldY })

    if (event.button === 1 || (event.button === 0 && panning())) {
      event.preventDefault()
      setPanning(true)
    }

    const target = event.target as HTMLElement
    const elementDiv = target.closest('[data-element-id]') as unknown as HTMLElement | null
    const elementIdFromDiv = elementDiv?.dataset.elementId
    const sicType = target.dataset.sicType

    if (
      (!sicType || sicType === 'element') &&
      elementIdFromDiv &&
      state.elements[elementIdFromDiv]
    ) {
      batch(() => {
        if (!state.selectedElements[clientId]?.includes(elementIdFromDiv)) {
          setState('selectedElements', clientId, [elementIdFromDiv])
          const maxZ = Math.max(0, ...Object.values(state.elements).map(el => el.rect.zIndex))
          setState('elements', elementIdFromDiv, 'rect', 'zIndex', maxZ + 1)
        }

        const initialRects = new Map<string, ElementState['rect']>()
        for (const id of state.selectedElements[clientId]!) {
          if (state.elements[id]) initialRects.set(id, { ...state.elements[id].rect })
        }

        setDragStart({
          stageX: worldX, // Use correct world coordinates
          stageY: worldY, // Use correct world coordinates
          target: { type: 'elements', initialRects },
        })
      })
    } else if (sicType === 'view') {
      setState('selectedElements', clientId, [])
      setDragStart({
        stageX: worldX, // Use correct world coordinates
        stageY: worldY, // Use correct world coordinates
        target: { type: 'stage' },
      })
    }

    for (const plugin of props.plugins) {
      plugin.events?.onMouseDown?.(event, stage)
    }
  }

  function onWindowMouseMove(event: MouseEvent) {
    if (!stageRef) return

    // --- 2. Correctly calculate world coordinates on mousemove ---
    const rect = stageRef.getBoundingClientRect()
    const currentCamera = camera()
    const worldX = (event.clientX - rect.left - currentCamera.x) / currentCamera.zoom
    const worldY = (event.clientY - rect.top - currentCamera.y) / currentCamera.zoom
    setMousePosition({ x: worldX, y: worldY })

    const dragStartValue = dragStart()

    // Update multiplayer cursor position
    setState('cursors', clientId, { x: worldX, y: worldY })

    if (panning()) {
      setCamera(prev => ({
        ...prev,
        x: prev.x + event.movementX,
        y: prev.y + event.movementY,
      }))
      return
    }

    if (!dragStartValue) {
      for (const plugin of props.plugins) {
        plugin.events?.onWindowMouseMove?.(event, stage)
      }
      return
    }

    // --- 3. Calculate delta in world space ---
    const dx = worldX - dragStartValue.stageX
    const dy = worldY - dragStartValue.stageY

    if (dragStartValue.target.type === 'elements') {
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
      const startWorldX = dragStartValue.stageX
      const startWorldY = dragStartValue.stageY
      setState('selectionBoxes', clientId, {
        x: Math.min(startWorldX, worldX),
        y: Math.min(startWorldY, worldY),
        width: Math.abs(worldX - startWorldX),
        height: Math.abs(worldY - startWorldY),
        hidden: false,
      })
    }

    for (const plugin of props.plugins) {
      plugin.events?.onWindowMouseMove?.(event, stage)
    }
  }

  function onWindowMouseUp(event: MouseEvent) {
    if (event.button === 1 || panning()) setPanning(false)

    const dragStartValue = dragStart()
    const selectionBox = state.selectionBoxes[clientId]

    if (dragStartValue?.target.type === 'stage' && selectionBox && !selectionBox.hidden) {
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

    for (const plugin of props.plugins) {
      plugin.events?.onWindowMouseUp?.(event, stage)
    }

    setDragStart(undefined)
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    setCamera(prev => ({
      ...prev,
      x: prev.x - event.deltaX,
      y: prev.y - event.deltaY,
    }))

    for (const plugin of props.plugins) {
      plugin.events?.onWheel?.(event, stage)
    }
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

    for (const plugin of props.plugins) {
      plugin.events?.onKeyDown?.(event, stage)
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key === ' ') setPanning(false)

    for (const plugin of props.plugins) {
      plugin.events?.onKeyUp?.(event, stage)
    }
  }

  onMount(() => {
    if (!stageRef) return
    setContainerSize({
      width: stageRef.clientWidth,
      height: stageRef.clientHeight,
    })
    stageRef.addEventListener('mousedown', onMouseDown)
    stageRef.addEventListener('keydown', onKeyDown)
    stageRef.addEventListener('keyup', onKeyUp)
    stageRef.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
  })

  onCleanup(() => {
    if (!stageRef) return
    stageRef.removeEventListener('mousedown', onMouseDown)
    stageRef.removeEventListener('keydown', onKeyDown)
    stageRef.removeEventListener('keyup', onKeyUp)
    stageRef.removeEventListener('wheel', onWheel)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
  })

  return (
    <main
      ref={stageRef}
      data-sic-type="stage"
      data-stage-id={stageId}
      tabIndex={0}
      style={{
        ...styles.stage,
        cursor: panning() ? (dragStart()?.target ? 'grabbing' : 'grab') : 'auto',
      }}
    >
      <Dynamic component={props.components.background ?? StageBackground} stage={stage} />
      <div
        data-sic-type="view"
        data-view-stage-id={stageId}
        style={{
          ...styles.view,
          transform: `translate(${camera().x}px, ${camera().y}px) scale(${camera().zoom})`,
        }}
      >
        {/* Render Plugins with a viewBack component */}
        <For each={props.plugins}>
          {plugin => (
            <Show when={plugin.components?.viewBack}>
              <Dynamic component={plugin.components!.viewBack} stage={stage} />
            </Show>
          )}
        </For>

        {/* Render Elements */}
        <For each={Object.entries(state.elements)}>
          {([id, element]) => (
            <div
              data-sic-type="element"
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
                stage={stage}
                elementId={id}
                renderableElements={props.components.elements}
              />
            </div>
          )}
        </For>

        {/* Render Selection Boxes */}
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

        {/* Render Plugins with a viewFront component */}
        <For each={props.plugins}>
          {plugin => (
            <Show when={plugin.components?.viewFront}>
              <Dynamic component={plugin.components!.viewFront} stage={stage} />
            </Show>
          )}
        </For>
      </div>
    </main>
  )
}

function StageBackground({ stage }: { stage: StageContextType }) {
  return (
    <div
      style={{
        ...styles.backgroundGrid,
        'background-position': `${stage.camera().x}px ${stage.camera().y}px`,
        'background-size': `${40 * stage.camera().zoom}px ${40 * stage.camera().zoom}px`,
        'pointer-events': 'none',
      }}
    ></div>
  )
}

const ElementRenderer: ElementRendererComponent = props => {
  const element = props.stage.state.elements[props.elementId]
  const isSelected = () =>
    props.stage.state.selectedElements[props.stage.clientId]?.includes(props.elementId)

  return (
    <Show when={element}>
      <For each={Object.entries(props.renderableElements)}>
        {([type, el]) => (
          <Show when={element?.type === type}>
            <Dynamic
              component={el}
              stage={props.stage}
              element={element}
              elementId={props.elementId}
              isSelected={isSelected}
            />
          </Show>
        )}
      </For>
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

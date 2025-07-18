import { CanvasElementComponent, createStageContext, Stage, useStage } from 'src'
import ResizePlugin, { ElementTransformControls } from 'plugins/ResizePlugin'
import ConnectionsPlugin, { ElementConnectionPoint } from 'plugins/ConnectionsPlugin'
import { onMount } from 'solid-js'

const CircleElement: CanvasElementComponent = ({ element, elementId }) => {
  const stage = useStage()
  const { setState } = stage

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
      <ElementConnectionPoint elementId={elementId} type="input" stagectx={stage} />
      <ElementConnectionPoint elementId={elementId} type="output" stagectx={stage} />
      <ElementTransformControls elementId={elementId} stagectx={stage} />
    </>
  )
}

const RectangleElement: CanvasElementComponent = ({ element, elementId }) => {
  const stage = useStage()
  const { setState } = stage

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
      <ElementConnectionPoint elementId={elementId} type="input" stagectx={stagectx} />
      <ElementConnectionPoint elementId={elementId} type="output" stagectx={stagectx} />
      <ElementTransformControls elementId={elementId} stagectx={stagectx} />
    </>
  )
}

const stagectx = createStageContext()
const { actions } = stagectx

const stagectx2 = createStageContext()
const { actions: actions2 } = stagectx2

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
          {/* Stage fills the container */}
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

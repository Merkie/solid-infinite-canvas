import { Component, Show } from 'solid-js'
import { StageContextType } from 'src'

export const ElementConnectionPoint: Component<{
  elementId: string
  type: 'input' | 'output'
  stagectx: StageContextType
}> = props => {
  const { state } = props.stagectx
  const element = state.elements[props.elementId]

  return (
    <Show when={element}>
      <div
        data-sic-type="connection-point"
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

import { Component, Show } from 'solid-js'
import { useStage } from 'src'
import styles from 'src/styles'

const ElementTransformControls: Component<{ elementId: string }> = props => {
  const { state, clientId } = useStage()
  return (
    <Show when={state.selectedElements[clientId]?.includes(props.elementId)}>
      <div style={styles.transformControls}>
        <div
          data-sic-type="resize-handle"
          data-element-id={props.elementId}
          data-resize-dir="top left"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleTopLeft }}
        />
        <div
          data-sic-type="resize-handle"
          data-element-id={props.elementId}
          data-resize-dir="top right"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleTopRight }}
        />
        <div
          data-sic-type="resize-handle"
          data-element-id={props.elementId}
          data-resize-dir="bottom left"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleBottomLeft }}
        />
        <div
          data-sic-type="resize-handle"
          data-element-id={props.elementId}
          data-resize-dir="bottom right"
          style={{ ...styles.resizeHandle, ...styles.resizeHandleBottomRight }}
        />
      </div>
    </Show>
  )
}

export default ElementTransformControls

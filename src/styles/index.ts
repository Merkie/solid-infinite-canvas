import { JSX } from 'solid-js/jsx-runtime'

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

export default styles

import { StagePlugin } from 'src'
import ElementTransformControls from './components/ElementTransformControls'

const ResizePlugin: StagePlugin = {
  name: 'resize',
  events: {
    onMouseDown: (event, stage) => {
      const { setDragStart, state, mousePosition } = stage

      const target = event.target as HTMLElement
      const resizeDir = target.dataset.resizeDir
      const elementId = target.closest('[data-element-id]')?.getAttribute('data-element-id')

      if (target.dataset.sicType === 'resize-handle' && elementId && state.elements[elementId]) {
        event.stopPropagation()
        setDragStart({
          stageX: mousePosition().x,
          stageY: mousePosition().y,
          target: {
            type: 'resize',
            elementId,
            ext: { resizeDir, initialRect: { ...state.elements[elementId].rect } },
          },
        })
      }
    },
    onWindowMouseMove: (event, stage) => {
      const { setState, dragStart, camera, mousePosition } = stage

      const dragStartValue = dragStart()
      const currentCamera = camera()

      if (!dragStartValue) return

      const dx = mousePosition().x - dragStartValue.stageX
      const dy = mousePosition().y - dragStartValue.stageY

      if (dragStartValue.target.type === 'resize') {
        event.preventDefault()
        event.stopPropagation()
        const { elementId, ext } = dragStartValue.target
        if (!elementId || !ext?.resizeDir || !ext.initialRect) return
        let { x, y, width, height } = ext.initialRect

        const MIN_SIZE = 20 / currentCamera.zoom

        if (ext.resizeDir.includes('right')) width = Math.max(MIN_SIZE, ext.initialRect.width + dx)
        if (ext.resizeDir.includes('left')) width = Math.max(MIN_SIZE, ext.initialRect.width - dx)
        if (ext.resizeDir.includes('bottom'))
          height = Math.max(MIN_SIZE, ext.initialRect.height + dy)
        if (ext.resizeDir.includes('top')) height = Math.max(MIN_SIZE, ext.initialRect.height - dy)

        if (event.shiftKey) {
          const aspectRatio = ext.initialRect.width / ext.initialRect.height
          if (Math.abs(dx) > Math.abs(dy)) {
            height = width / aspectRatio
          } else {
            width = height * aspectRatio
          }
        }

        if (ext.resizeDir.includes('left')) x = ext.initialRect.x + ext.initialRect.width - width
        if (ext.resizeDir.includes('top')) y = ext.initialRect.y + ext.initialRect.height - height

        setState('elements', elementId, 'rect', prev => ({
          ...prev,
          x,
          y,
          width,
          height,
        }))
      }
    },
  },
}

export default ResizePlugin
export { ElementTransformControls }

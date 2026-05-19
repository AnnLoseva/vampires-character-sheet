import type { CSSProperties } from 'react'
import type { ChatMessage, ImageEditorState, RollMessage, TableLayer } from './types'

export function mergeRoll(rolls: RollMessage[], roll: RollMessage) {
  if (rolls.some(item => item.id === roll.id)) return rolls
  return [roll, ...rolls].slice(0, 80)
}

export function mergeChatMessage(messages: ChatMessage[], message: ChatMessage) {
  if (messages.some(item => item.id === message.id)) return messages
  return [...messages, message]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-120)
}

export function upsertLayer(layers: TableLayer[], layer: TableLayer) {
  const exists = layers.some(item => item.id === layer.id)
  const next = exists ? layers.map(item => (item.id === layer.id ? layer : item)) : [...layers, layer]
  return sortLayers(next).slice(0, 80)
}

export function sortLayers(layers: TableLayer[]) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt))
}

export function getLayerCrop(layer: TableLayer) {
  const cropX = Math.max(0, Math.min(95, layer.cropX ?? 0))
  const cropY = Math.max(0, Math.min(95, layer.cropY ?? 0))
  const cropWidth = Math.max(1, Math.min(100 - cropX, layer.cropWidth ?? 100))
  const cropHeight = Math.max(1, Math.min(100 - cropY, layer.cropHeight ?? 100))
  const cropped = cropX > 0 || cropY > 0 || cropWidth < 100 || cropHeight < 100
  return { cropX, cropY, cropWidth, cropHeight, cropped }
}

export function getCroppedMediaStyle(layer: TableLayer): CSSProperties {
  const crop = getLayerCrop(layer)
  if (!crop.cropped) return {}
  return {
    width: `${10000 / crop.cropWidth}%`,
    height: `${10000 / crop.cropHeight}%`,
    transform: `translate(${-crop.cropX}%, ${-crop.cropY}%)`,
    transformOrigin: '0 0',
  }
}

export function getLayerMediaStyle(layer: TableLayer): CSSProperties {
  const cropStyle = getCroppedMediaStyle(layer)
  return {
    ...cropStyle,
    filter: `brightness(${layer.brightness}) contrast(${layer.contrast}) saturate(${layer.saturation})`,
    transform: [
      cropStyle.transform,
      `rotate(${layer.rotation}deg)`,
      `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`,
    ].filter(Boolean).join(' '),
  }
}

export function getSmartFloatingPosition(x: number, y: number, width: number, height: number, margin = 12) {
  if (typeof window === 'undefined') return { left: x, top: y }
  const left = x + width + margin > window.innerWidth ? Math.max(margin, x - width - margin) : Math.max(margin, x)
  const top = y + height + margin > window.innerHeight ? Math.max(margin, y - height - margin) : Math.max(margin, y)
  return { left, top }
}

export function createEditorState(layer: TableLayer): ImageEditorState {
  const crop = getLayerCrop(layer)
  return {
    cropX: crop.cropX,
    cropY: crop.cropY,
    cropWidth: crop.cropWidth,
    cropHeight: crop.cropHeight,
    rotation: layer.rotation,
    flipX: layer.flipX,
    flipY: layer.flipY,
    brightness: layer.brightness,
    contrast: layer.contrast,
    saturation: layer.saturation,
  }
}

// Shows the FULL image (no crop transform) so the user can pick the crop region
export function getEditorPreviewStyle(state: ImageEditorState): CSSProperties {
  return {
    filter: `brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation})`,
    transform: `rotate(${state.rotation}deg) scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`,
    transformOrigin: '50% 50%',
  }
}

export function getEditorImageStyle(state: ImageEditorState): CSSProperties {
  return {
    width: `${10000 / state.cropWidth}%`,
    height: `${10000 / state.cropHeight}%`,
    transform: `translate(${-state.cropX}%, ${-state.cropY}%) rotate(${state.rotation}deg) scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`,
    transformOrigin: '50% 50%',
    filter: `brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation})`,
  }
}

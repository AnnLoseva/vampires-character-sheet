import type { Dispatch, DragEvent, PointerEvent, RefObject, SetStateAction, TouchEvent, WheelEvent } from 'react'
import {
  createEditorState,
  getEditorImageStyle,
  getLayerCrop,
  getLayerMediaStyle,
} from '@/lib/table/layer-utils'
import {
  getDocumentEmbedUrl,
  getEmbeddableVideoUrl,
  getFileLayerMeta,
} from '@/lib/table/media-utils'
import type { DragState, ImageEditorDraft, ImageEditorState, LayerContextMenu, LayerPatch, SelectionRect, TableLayer, TableScene } from '@/lib/table/types'

type TableCanvasProps = {
  tableStatus: string
  activeScene: TableScene | null | undefined
  layersLength: number
  zoom: number
  pan: { x: number; y: number }
  handNotice: string
  isDraggingOver: boolean
  visibleLayers: TableLayer[]
  selectedLayerId: string | null
  selectedLayerIds: Set<string>
  imageEditor: ImageEditorDraft | null
  selectionRect: SelectionRect
  sceneRef: RefObject<HTMLDivElement | null>
  suppressNextContextMenuRef: RefObject<boolean>
  canEditLayer: (layer: TableLayer) => boolean
  raiseHand: () => void
  setZoom: Dispatch<SetStateAction<number>>
  setIsDraggingOver: Dispatch<SetStateAction<boolean>>
  setLayerContextMenu: Dispatch<SetStateAction<LayerContextMenu>>
  setLayerSelection: (ids: string[], primaryId?: string | null) => void
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  setImageEditor: Dispatch<SetStateAction<ImageEditorDraft | null>>
  startPan: (event: PointerEvent<HTMLDivElement>) => void
  updateLayerDrag: (event: PointerEvent<HTMLDivElement>) => void
  finishLayerDrag: () => void
  startSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  updateSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  finishSceneTouch: (event: TouchEvent<HTMLDivElement>) => void
  handleWheel: (event: WheelEvent<HTMLDivElement>) => void
  handleDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>
  startLayerDrag: (event: PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner?: DragState['corner']) => void
  openImageEditor: (layer: TableLayer) => void
  revealLayerInTableManager: (layer: TableLayer) => void
  updateEditorCropDrag: (event: PointerEvent<HTMLElement>) => void
  finishEditorCropDrag: () => void
  startEditorCropDrag: (event: PointerEvent<HTMLElement>, handle: NonNullable<ImageEditorDraft['drag']>['handle']) => void
  applyImageEditor: (saveAsNew?: boolean) => Promise<void>
  updateImageEditor: (updater: (state: ImageEditorState) => ImageEditorState, commit?: boolean) => void
  undoImageEditor: () => void
  redoImageEditor: () => void
  patchLayer: (id: string, patch: LayerPatch) => Promise<void>
}

export default function TableCanvas({
  tableStatus,
  activeScene,
  layersLength,
  zoom,
  pan,
  handNotice,
  isDraggingOver,
  visibleLayers,
  selectedLayerId,
  selectedLayerIds,
  imageEditor,
  selectionRect,
  sceneRef,
  suppressNextContextMenuRef,
  canEditLayer,
  raiseHand,
  setZoom,
  setIsDraggingOver,
  setLayerContextMenu,
  setLayerSelection,
  setSelectedLayerId,
  setImageEditor,
  startPan,
  updateLayerDrag,
  finishLayerDrag,
  startSceneTouch,
  updateSceneTouch,
  finishSceneTouch,
  handleWheel,
  handleDrop,
  startLayerDrag,
  openImageEditor,
  revealLayerInTableManager,
  updateEditorCropDrag,
  finishEditorCropDrag,
  startEditorCropDrag,
  applyImageEditor,
  updateImageEditor,
  undoImageEditor,
  redoImageEditor,
  patchLayer,
}: TableCanvasProps) {
  return (
    <section className="play-surface" aria-label="Игровой стол">
      <header className="surface-head">
        <div>
          <span>{tableStatus}</span>
          <strong>{activeScene?.name || (layersLength ? `${layersLength} слоёв` : 'Пустая сцена')}</strong>
        </div>
        <div>
          <span>Масштаб</span>
          <strong>{Math.round(zoom * 100)}%</strong>
        </div>
        <div className="zoom-tools">
          <button type="button" onClick={raiseHand} title="Поднять руку">!</button>
          <button type="button" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}>−</button>
          <button type="button" onClick={() => setZoom(1)}>100</button>
          <button type="button" onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}>+</button>
        </div>
      </header>
      {handNotice ? <div className="hand-notice" role="status">{handNotice}</div> : null}

      <div
        ref={sceneRef}
        className={`scene ${isDraggingOver ? 'drag-over' : ''}`}
        onPointerDown={startPan}
        onPointerMove={updateLayerDrag}
        onPointerUp={finishLayerDrag}
        onPointerCancel={finishLayerDrag}
        onPointerLeave={finishLayerDrag}
        onTouchStart={startSceneTouch}
        onTouchMove={updateSceneTouch}
        onTouchEnd={finishSceneTouch}
        onTouchCancel={finishSceneTouch}
        onContextMenu={event => {
          event.preventDefault()
          if (suppressNextContextMenuRef.current) {
            suppressNextContextMenuRef.current = false
            return
          }
          if (selectedLayerIds.size > 0) setLayerContextMenu({ layerId: null, x: event.clientX, y: event.clientY })
        }}
        onWheel={handleWheel}
        onDragOver={event => {
          event.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <div
          className="scene-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {visibleLayers.length === 0 ? (
            <div className="scene-empty">
              <h2>Добавь первый слой</h2>
              <p>Перетащи картинки прямо на стол или нажми «Добавить слой».</p>
            </div>
          ) : null}

          {visibleLayers.map(layer => (
            <div
              className={`scene-layer ${layer.layerType === 'image' ? 'image-layer' : ''} ${layer.layerType === 'video' ? 'video-layer' : ''} ${layer.layerType === 'text' ? 'text-layer' : ''} ${getLayerCrop(layer).cropped ? 'cropped-layer' : ''} ${selectedLayerIds.has(layer.id) ? 'selected' : ''} ${layer.locked || !canEditLayer(layer) ? 'locked' : ''}`}
              key={layer.id}
              style={{
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                zIndex: layer.zIndex,
                opacity: layer.opacity,
                mixBlendMode: layer.blendMode,
              }}
              onPointerDown={event => startLayerDrag(event, layer, 'move')}
              onContextMenu={event => {
                event.preventDefault()
                event.stopPropagation()
                if (suppressNextContextMenuRef.current) {
                  suppressNextContextMenuRef.current = false
                  return
                }
                if (!selectedLayerIds.has(layer.id)) setLayerSelection([layer.id], layer.id)
                else setSelectedLayerId(layer.id)
                setLayerContextMenu({ layerId: layer.id, x: event.clientX, y: event.clientY })
              }}
              onDoubleClick={event => {
                event.preventDefault()
                event.stopPropagation()
                if (['image', 'video'].includes(layer.layerType)) openImageEditor(layer)
                else revealLayerInTableManager(layer)
              }}
              onClick={event => {
                event.stopPropagation()
                if (!['image', 'video'].includes(layer.layerType) || !canEditLayer(layer) || layer.locked) return
                if (selectedLayerId === layer.id && imageEditor?.layerId !== layer.id) openImageEditor(layer)
              }}
            >
              {layer.layerType === 'video' ? (
                <>
                  {getEmbeddableVideoUrl(layer.imageData) ? (
                    <>
                      <iframe
                        src={getEmbeddableVideoUrl(layer.imageData)}
                        title={layer.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                      <button
                        type="button"
                        className="embedded-video-drag-handle"
                        onPointerDown={event => {
                          event.stopPropagation()
                          startLayerDrag(event, layer, 'move')
                        }}
                        title="Переместить видео"
                        aria-label="Переместить видео"
                      >
                        ⠿
                      </button>
                    </>
                  ) : (
                    <video
                      src={layer.imageData}
                      controls
                      loop
                      playsInline
                      draggable={false}
                      style={imageEditor?.layerId === layer.id ? getEditorImageStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                      onError={event => {
                        event.currentTarget.style.display = 'none'
                        event.currentTarget.parentElement?.classList.add('image-load-error')
                      }}
                    />
                  )}
                  <span className="broken-image-label">{layer.name}</span>
                </>
              ) : layer.layerType === 'text' ? (
                <article className="scene-text-material">
                  <strong>{layer.name}</strong>
                  <div dangerouslySetInnerHTML={{ __html: layer.imageData }} />
                </article>
              ) : layer.layerType === 'file' ? (() => {
                const meta = getFileLayerMeta(layer.imageData, layer.name)
                const embedUrl = getDocumentEmbedUrl(meta)
                return (
                  <article className={`scene-file-material ${embedUrl ? 'embedded-document' : ''}`}>
                    <strong>{layer.name}</strong>
                    {embedUrl ? (
                      <iframe src={embedUrl} title={layer.name} />
                    ) : (
                      <>
                        <span>{meta.type}</span>
                        <a href={meta.url} target="_blank" rel="noreferrer">Открыть файл</a>
                      </>
                    )}
                  </article>
                )
              })() : (
                <>
                  <img
                    src={layer.imageData}
                    alt=""
                    draggable={false}
                    style={imageEditor?.layerId === layer.id ? getEditorImageStyle(imageEditor.state) : getLayerMediaStyle(layer)}
                    onError={event => {
                      event.currentTarget.style.display = 'none'
                      event.currentTarget.parentElement?.classList.add('image-load-error')
                    }}
                  />
                  <span className="broken-image-label">{layer.name}</span>
                </>
              )}
              {imageEditor?.layerId === layer.id ? (
                <div
                  className="inline-crop-surface"
                  onPointerMove={updateEditorCropDrag}
                  onPointerUp={finishEditorCropDrag}
                  onPointerCancel={finishEditorCropDrag}
                  onPointerLeave={finishEditorCropDrag}
                >
                  <div
                    className="inline-crop-box"
                    style={{
                      left: `${imageEditor.state.cropX}%`,
                      top: `${imageEditor.state.cropY}%`,
                      width: `${imageEditor.state.cropWidth}%`,
                      height: `${imageEditor.state.cropHeight}%`,
                    }}
                    onPointerDown={event => startEditorCropDrag(event, 'move')}
                  >
                    {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                      <button
                        type="button"
                        key={handle}
                        className={`crop-handle ${handle}`}
                        onPointerDown={event => startEditorCropDrag(event, handle)}
                        aria-label="Изменить обрезку"
                      />
                    ))}
                  </div>
                  <div className="inline-crop-toolbar" onPointerDown={event => event.stopPropagation()}>
                    <button type="button" onClick={() => applyImageEditor(false)}>Применить</button>
                    <button type="button" onClick={() => setImageEditor(null)}>Отменить</button>
                    <button type="button" onClick={() => updateImageEditor(() => createEditorState({ ...layer, cropX: null, cropY: null, cropWidth: null, cropHeight: null, rotation: 0, flipX: false, flipY: false, brightness: 1, contrast: 1, saturation: 1 }))}>Сбросить</button>
                    <button type="button" onClick={undoImageEditor} disabled={imageEditor.history.length === 0}>Undo</button>
                    <button type="button" onClick={redoImageEditor} disabled={imageEditor.future.length === 0}>Redo</button>
                    <button type="button" className={imageEditor.aspectLocked ? 'active' : ''} onClick={() => setImageEditor(editor => editor ? { ...editor, aspectLocked: !editor.aspectLocked } : editor)}>Lock</button>
                    <button type="button" onClick={() => updateImageEditor(state => ({ ...state, rotation: (state.rotation + 90) % 360 }))}>↻</button>
                    <button type="button" onClick={() => updateImageEditor(state => ({ ...state, flipX: !state.flipX }))}>⇋</button>
                  </div>
                </div>
              ) : null}
              {selectedLayerId === layer.id && ['image', 'video'].includes(layer.layerType) && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                <label className="inline-opacity-control" onPointerDown={event => event.stopPropagation()}>
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={event => void patchLayer(layer.id, { opacity: Number(event.target.value) })}
                  />
                </label>
              ) : null}
              {selectedLayerId === layer.id && selectedLayerIds.size <= 1 && !layer.locked && canEditLayer(layer) && imageEditor?.layerId !== layer.id ? (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
                    <button
                      type="button"
                      className={`resize-handle ${corner}`}
                      key={corner}
                      onPointerDown={event => {
                        event.stopPropagation()
                        startLayerDrag(event, layer, 'resize', corner)
                      }}
                      title="Изменить размер"
                    />
                  ))}
                </>
              ) : null}
            </div>
          ))}
          {selectionRect ? (
            <div
              className="selection-rect"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

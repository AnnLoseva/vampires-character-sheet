'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Die = {
  value: number
  kind: 'fail' | 'success' | 'critical' | 'botch'
}

type RollMessage = {
  id: string
  room: string
  characterName: string
  poolName: string
  poolType: string
  diceCount: number
  dice: Die[]
  successes: number
  createdAt: string
}

type RollRow = {
  id: string
  room: string
  character_name: string
  pool_name: string
  pool_type: string
  dice_count: number
  dice: Die[]
  successes: number
  created_at: string
}

type TableLayer = {
  id: string
  room: string
  name: string
  imageData: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  visible: boolean
  locked: boolean
  createdAt: string
}

type TableLayerRow = {
  id: string
  room: string
  name: string
  image_data: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  z_index: number | null
  visible: boolean | null
  locked: boolean | null
  created_at: string
}

type LayerPatch = Partial<Pick<TableLayer, 'name' | 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'visible' | 'locked'>>

type DragState = {
  id: string
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

const TABLE_ROLLS = 'table_rolls'
const TABLE_IMAGES = 'table_images'

function getRoomFromLocation() {
  if (typeof window === 'undefined') return 'campaign-666'
  return new URLSearchParams(window.location.search).get('room') || 'campaign-666'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function mergeRoll(rolls: RollMessage[], roll: RollMessage) {
  if (rolls.some(item => item.id === roll.id)) return rolls
  return [roll, ...rolls].slice(0, 80)
}

function upsertLayer(layers: TableLayer[], layer: TableLayer) {
  const exists = layers.some(item => item.id === layer.id)
  const next = exists ? layers.map(item => (item.id === layer.id ? layer : item)) : [...layers, layer]
  return sortLayers(next).slice(0, 80)
}

function sortLayers(layers: TableLayer[]) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt))
}

function mapRollRow(row: RollRow): RollMessage {
  return {
    id: row.id,
    room: row.room,
    characterName: row.character_name,
    poolName: row.pool_name,
    poolType: row.pool_type,
    diceCount: row.dice_count,
    dice: row.dice || [],
    successes: row.successes,
    createdAt: row.created_at,
  }
}

function mapLayerRow(row: TableLayerRow): TableLayer {
  return {
    id: row.id,
    room: row.room,
    name: row.name,
    imageData: row.image_data,
    x: row.x ?? 80,
    y: row.y ?? 80,
    width: row.width ?? 420,
    height: row.height ?? 280,
    zIndex: row.z_index ?? 1,
    visible: row.visible ?? true,
    locked: row.locked ?? false,
    createdAt: row.created_at,
  }
}

function toDbPatch(patch: LayerPatch) {
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.x !== undefined) dbPatch.x = patch.x
  if (patch.y !== undefined) dbPatch.y = patch.y
  if (patch.width !== undefined) dbPatch.width = patch.width
  if (patch.height !== undefined) dbPatch.height = patch.height
  if (patch.zIndex !== undefined) dbPatch.z_index = patch.zIndex
  if (patch.visible !== undefined) dbPatch.visible = patch.visible
  if (patch.locked !== undefined) dbPatch.locked = patch.locked
  return dbPatch
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function getImageSize(src: string) {
  return new Promise<{ width: number; height: number }>(resolve => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 420, height: image.naturalHeight || 280 })
    image.onerror = () => resolve({ width: 420, height: 280 })
    image.src = src
  })
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [layers, setLayers] = useState<TableLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const layersRef = useRef<TableLayer[]>([])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    const currentRoom = getRoomFromLocation()
    const supabase = createClient()
    let cancelled = false

    setRoom(currentRoom)

    supabase
      .from(TABLE_ROLLS)
      .select('id, room, character_name, pool_name, pool_type, dice_count, dice, successes, created_at')
      .eq('room', currentRoom)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить историю бросков:', error)
          setConnectionText('Нет общей истории')
          return
        }

        setRolls((data || []).map(row => mapRollRow(row as RollRow)))
        setConnectionText('Онлайн')
      })

    supabase
      .from(TABLE_IMAGES)
      .select('id, room, name, image_data, x, y, width, height, z_index, visible, locked, created_at')
      .eq('room', currentRoom)
      .order('z_index', { ascending: true })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить слои стола:', error)
          setTableStatus('Нет общей сцены')
          return
        }

        setLayers(sortLayers((data || []).map(row => mapLayerRow(row as TableLayerRow))))
        setTableStatus('Сцена онлайн')
      })

    const channel = supabase
      .channel(`table-room:${currentRoom}`)
      .on('broadcast', { event: 'roll' }, payload => {
        const roll = payload.payload as RollMessage
        if (!roll || roll.room !== currentRoom) return
        setRolls(prev => mergeRoll(prev, roll))
        setConnectionText('Онлайн')
      })
      .on('broadcast', { event: 'layer' }, payload => {
        const layer = payload.payload as TableLayer
        if (!layer || layer.room !== currentRoom) return
        setLayers(prev => upsertLayer(prev, layer))
        setTableStatus('Сцена онлайн')
      })
      .on('broadcast', { event: 'layer-update' }, payload => {
        const update = payload.payload as { id?: string; room?: string; patch?: LayerPatch }
        if (!update.id || update.room !== currentRoom || !update.patch) return
        setLayers(prev => sortLayers(prev.map(layer => (layer.id === update.id ? { ...layer, ...update.patch } : layer))))
      })
      .on('broadcast', { event: 'layer-delete' }, payload => {
        const id = String((payload.payload as { id?: string })?.id || '')
        if (!id) return
        setLayers(prev => prev.filter(layer => layer.id !== id))
        setSelectedLayerId(prev => (prev === id ? null : prev))
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_ROLLS,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          setRolls(prev => mergeRoll(prev, mapRollRow(payload.new as RollRow)))
          setConnectionText('Онлайн')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          setLayers(prev => upsertLayer(prev, mapLayerRow(payload.new as TableLayerRow)))
          setTableStatus('Сцена онлайн')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          setLayers(prev => upsertLayer(prev, mapLayerRow(payload.new as TableLayerRow)))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: TABLE_IMAGES,
          filter: `room=eq.${currentRoom}`,
        },
        payload => {
          const deleted = payload.old as { id?: string }
          if (deleted.id) {
            setLayers(prev => prev.filter(layer => layer.id !== deleted.id))
            setSelectedLayerId(prev => (prev === deleted.id ? null : prev))
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnectionText('Онлайн')
        if (status === 'CHANNEL_ERROR') setConnectionText('Realtime недоступен')
        if (status === 'TIMED_OUT') setConnectionText('Повтор подключения')
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [])

  const latest = rolls[0]
  const totalDice = useMemo(() => rolls.reduce((sum, roll) => sum + roll.diceCount, 0), [rolls])
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || null
  const visibleLayers = useMemo(() => sortLayers(layers).filter(layer => layer.visible), [layers])
  const layerPanelItems = useMemo(() => sortLayers(layers).reverse(), [layers])

  const broadcast = (event: string, payload: unknown) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }

  const patchLayer = async (id: string, patch: LayerPatch, options: { persist?: boolean } = { persist: true }) => {
    const nextLayers = sortLayers(layersRef.current.map(layer => (layer.id === id ? { ...layer, ...patch } : layer)))
    layersRef.current = nextLayers
    setLayers(nextLayers)
    broadcast('layer-update', { id, room, patch })

    if (options.persist === false) return

    const { error } = await createClient().from(TABLE_IMAGES).update(toDbPatch(patch)).eq('id', id)
    if (error) {
      console.error('Не удалось обновить слой:', error)
      setTableStatus('Слой не сохранился')
    }
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      window.alert('Можно загрузить только картинку.')
      event.target.value = ''
      return
    }

    setIsUploading(true)

    try {
      const imageData = await readFileAsDataUrl(file)
      const natural = await getImageSize(imageData)
      const maxZ = layersRef.current.reduce((max, layer) => Math.max(max, layer.zIndex), 0)
      const fitWidth = Math.min(760, Math.max(220, natural.width))
      const fitHeight = Math.max(160, Math.round((fitWidth / natural.width) * natural.height))
      const layer: TableLayer = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room,
        name: file.name,
        imageData,
        x: 80 + (layers.length % 6) * 28,
        y: 70 + (layers.length % 6) * 24,
        width: fitWidth,
        height: fitHeight,
        zIndex: maxZ + 1,
        visible: true,
        locked: false,
        createdAt: new Date().toISOString(),
      }

      const { error } = await createClient().from(TABLE_IMAGES).insert({
        id: layer.id,
        room: layer.room,
        name: layer.name,
        image_data: layer.imageData,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        z_index: layer.zIndex,
        visible: layer.visible,
        locked: layer.locked,
        created_at: layer.createdAt,
      })

      setLayers(prev => upsertLayer(prev, layer))
      setSelectedLayerId(layer.id)
      broadcast('layer', layer)

      if (error) {
        console.error('Не удалось сохранить слой стола:', error)
        setTableStatus('Слой показан онлайн, но не сохранён')
        window.alert('Слой показан онлайн, но не сохранился. Нужно обновить table_images в Supabase.')
        return
      }

      setTableStatus('Сцена онлайн')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const deleteLayer = async (layerId: string) => {
    if (!window.confirm('Удалить слой со стола?')) return

    const nextLayers = layersRef.current.filter(layer => layer.id !== layerId)
    layersRef.current = nextLayers
    setLayers(nextLayers)
    setSelectedLayerId(prev => (prev === layerId ? null : prev))
    broadcast('layer-delete', { id: layerId, room })
    await createClient().from(TABLE_IMAGES).delete().eq('id', layerId)
  }

  const moveLayerOrder = async (layerId: string, direction: 'up' | 'down') => {
    const ordered = sortLayers(layersRef.current)
    const index = ordered.findIndex(layer => layer.id === layerId)
    const targetIndex = direction === 'up' ? index + 1 : index - 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const current = ordered[index]
    const target = ordered[targetIndex]
    await Promise.all([
      patchLayer(current.id, { zIndex: target.zIndex }),
      patchLayer(target.id, { zIndex: current.zIndex }),
    ])
  }

  const startLayerDrag = (event: React.PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize') => {
    if (layer.locked) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedLayerId(layer.id)
    dragRef.current = {
      id: layer.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      startHeight: layer.height,
    }
  }

  const updateLayerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return

    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY

    if (drag.mode === 'move') {
      patchLayer(drag.id, { x: Math.round(drag.startX + dx), y: Math.round(drag.startY + dy) }, { persist: false })
      return
    }

    patchLayer(
      drag.id,
      {
        width: Math.max(60, Math.round(drag.startWidth + dx)),
        height: Math.max(60, Math.round(drag.startHeight + dy)),
      },
      { persist: false }
    )
  }

  const finishLayerDrag = async () => {
    const drag = dragRef.current
    if (!drag) return

    dragRef.current = null
    const layer = layersRef.current.find(item => item.id === drag.id)
    if (layer) {
      await patchLayer(layer.id, {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      })
    }
  }

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">Игровой стол</p>
          <h1>Стол: {room}</h1>
        </div>
        <div className="table-actions">
          <a href="/old" title="Открыть лист персонажа">Лист</a>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Загрузка...' : 'Добавить слой'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} />
        </div>
      </section>

      <section className="table-layout">
        <section className="play-surface" aria-label="Игровой стол">
          <header className="surface-head">
            <div>
              <span>{tableStatus}</span>
              <strong>{layers.length ? `${layers.length} слоёв` : 'Пустая сцена'}</strong>
            </div>
            <div>
              <span>Связь</span>
              <strong>{connectionText}</strong>
            </div>
          </header>

          <div
            ref={sceneRef}
            className="scene"
            onPointerMove={updateLayerDrag}
            onPointerUp={finishLayerDrag}
            onPointerCancel={finishLayerDrag}
            onPointerLeave={finishLayerDrag}
          >
            {visibleLayers.length === 0 ? (
              <div className="scene-empty">
                <h2>Добавь первый слой</h2>
                <p>Загрузи карту, сцену или портрет. Дальше их можно двигать, менять размер и раскладывать по слоям.</p>
              </div>
            ) : null}

            {visibleLayers.map(layer => (
              <div
                className={`scene-layer ${selectedLayerId === layer.id ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`}
                key={layer.id}
                style={{
                  left: layer.x,
                  top: layer.y,
                  width: layer.width,
                  height: layer.height,
                  zIndex: layer.zIndex,
                }}
                onPointerDown={event => startLayerDrag(event, layer, 'move')}
              >
                <img src={layer.imageData} alt={layer.name} draggable={false} />
                {selectedLayerId === layer.id && !layer.locked ? (
                  <button
                    type="button"
                    className="resize-handle"
                    onPointerDown={event => {
                      event.stopPropagation()
                      startLayerDrag(event, layer, 'resize')
                    }}
                    title="Изменить размер"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="right-rail">
          <section className="layer-panel" aria-label="Слои стола">
            <header>
              <strong>Слои</strong>
              <span>{selectedLayer?.name || 'ничего не выбрано'}</span>
            </header>

            <div className="layer-list">
              {layerPanelItems.length === 0 ? (
                <p className="panel-empty">Слоёв пока нет.</p>
              ) : (
                layerPanelItems.map(layer => (
                  <article className={`layer-row ${selectedLayerId === layer.id ? 'active' : ''}`} key={layer.id}>
                    <button type="button" className="layer-name" onClick={() => setSelectedLayerId(layer.id)}>
                      <img src={layer.imageData} alt="" />
                      <span>{layer.name}</span>
                    </button>
                    <div className="layer-tools">
                      <button type="button" onClick={() => patchLayer(layer.id, { visible: !layer.visible })} title="Показать/скрыть">
                        {layer.visible ? '👁' : '—'}
                      </button>
                      <button type="button" onClick={() => patchLayer(layer.id, { locked: !layer.locked })} title="Блокировка">
                        {layer.locked ? '🔒' : '○'}
                      </button>
                      <button type="button" onClick={() => moveLayerOrder(layer.id, 'up')} title="Выше">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveLayerOrder(layer.id, 'down')} title="Ниже">
                        ↓
                      </button>
                      <button type="button" onClick={() => deleteLayer(layer.id)} title="Удалить">
                        x
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="roll-sidebar" aria-label="История бросков">
            <header>
              <div>
                <span>Броски</span>
                <strong>{rolls.length}</strong>
              </div>
              <div>
                <span>Кубы</span>
                <strong>{totalDice}</strong>
              </div>
              <div>
                <span>Итог</span>
                <strong>{latest ? latest.successes : 0}</strong>
              </div>
            </header>

            <section className="roll-list">
              {rolls.length === 0 ? (
                <p className="panel-empty">Бросков пока нет.</p>
              ) : (
                rolls.map(roll => (
                  <article className="roll-card" key={roll.id}>
                    <div className="roll-meta">
                      <strong>{roll.characterName}</strong>
                      <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                    </div>
                    <span className="roll-pool">{roll.poolName}</span>

                    <div className="dice-row" aria-label={`Результаты кубиков: ${roll.dice.map(die => die.value).join(', ')}`}>
                      {roll.dice.map((die, index) => (
                        <span className={`die die-${die.kind}`} key={`${roll.id}-${index}`}>
                          {die.value}
                        </span>
                      ))}
                    </div>

                    <footer>
                      <span>{roll.diceCount}к10</span>
                      <strong>{roll.successes}</strong>
                    </footer>
                  </article>
                ))
              )}
            </section>
          </section>
        </aside>
      </section>

      <style jsx global>{`
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100vh !important;
          background: #090909 !important;
          color: #f4f4f4 !important;
          display: block !important;
          overflow: hidden !important;
        }
      `}</style>
      <style jsx>{`
        .table-page-shell {
          min-height: 100vh;
          padding: 18px;
          font-family: "Courier New", Courier, monospace;
          background:
            linear-gradient(180deg, rgba(120, 0, 0, 0.16), rgba(0, 0, 0, 0) 250px),
            #090909;
        }

        .table-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 0 auto 14px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 12px;
        }

        .table-kicker {
          margin: 0 0 5px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          letter-spacing: 0;
        }

        .table-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .table-actions input {
          display: none;
        }

        .table-actions a,
        .table-actions button,
        .layer-tools button {
          border: 1px solid #773030;
          background: #141414;
          color: #f5f5f5;
          border-radius: 6px;
          padding: 9px 12px;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .table-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .table-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 12px;
          height: calc(100vh - 106px);
          min-height: 560px;
        }

        .play-surface,
        .layer-panel,
        .roll-sidebar {
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          overflow: hidden;
        }

        .play-surface {
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .surface-head,
        .layer-panel header,
        .roll-sidebar header {
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .surface-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
        }

        .surface-head div {
          display: grid;
          gap: 4px;
        }

        .surface-head span,
        .layer-panel header span,
        .roll-sidebar header span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .surface-head strong,
        .layer-panel header strong,
        .roll-sidebar header strong {
          color: #f5f5f5;
          font-size: 15px;
        }

        .scene {
          position: relative;
          min-height: 0;
          overflow: auto;
          background-color: #080808;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .scene-empty {
          position: absolute;
          inset: 20px;
          display: grid;
          place-content: center;
          text-align: center;
          color: #aaa;
          border: 1px dashed #3a3a3a;
          border-radius: 8px;
          pointer-events: none;
        }

        .scene-empty h2 {
          margin: 0 0 8px;
          color: #fff;
          letter-spacing: 0;
          text-transform: none;
          border: 0;
          padding: 0;
        }

        .scene-empty p {
          margin: 0;
          max-width: 500px;
        }

        .scene-layer {
          position: absolute;
          border: 1px solid transparent;
          background: #050505;
          user-select: none;
          touch-action: none;
          cursor: move;
          box-shadow: 0 10px 30px rgba(0,0,0,0.28);
        }

        .scene-layer.selected {
          border-color: #36d675;
          box-shadow: 0 0 0 2px rgba(54, 214, 117, 0.2), 0 12px 34px rgba(0,0,0,0.36);
        }

        .scene-layer.locked {
          cursor: default;
          opacity: 0.82;
        }

        .scene-layer img {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
          pointer-events: none;
        }

        .resize-handle {
          position: absolute;
          right: -7px;
          bottom: -7px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #0b0b0b;
          background: #36d675;
          cursor: nwse-resize;
        }

        .right-rail {
          min-width: 0;
          display: grid;
          grid-template-rows: minmax(220px, 0.45fr) minmax(260px, 0.55fr);
          gap: 12px;
        }

        .layer-panel,
        .roll-sidebar {
          min-height: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .layer-panel header {
          display: grid;
          gap: 4px;
          padding: 12px;
        }

        .layer-list,
        .roll-list {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .panel-empty {
          margin: auto;
          color: #888;
          text-align: center;
          font-size: 13px;
        }

        .layer-row {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          overflow: hidden;
        }

        .layer-row.active {
          border-color: #36d675;
        }

        .layer-name {
          width: 100%;
          border: 0;
          background: transparent;
          color: #f4f4f4;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          padding: 8px;
          cursor: pointer;
          text-align: left;
          font: inherit;
        }

        .layer-name img {
          width: 42px;
          height: 30px;
          object-fit: cover;
          background: #050505;
          border-radius: 4px;
          border: 1px solid #333;
        }

        .layer-name span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .layer-tools {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
          padding: 0 8px 8px;
        }

        .layer-tools button {
          padding: 6px 0;
          border-color: #3a3a3a;
          font-size: 12px;
        }

        .roll-sidebar header {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .roll-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 10px;
          border-right: 1px solid #292929;
        }

        .roll-sidebar header div:last-child {
          border-right: none;
        }

        .roll-sidebar header strong {
          color: #36d675;
          font-size: 19px;
        }

        .roll-card {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
        }

        .roll-meta,
        .roll-card footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .roll-meta strong {
          font-size: 14px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .roll-meta time,
        .roll-pool,
        .roll-card footer span {
          color: #aaa;
          font-size: 12px;
        }

        .roll-pool {
          display: block;
          margin-top: 4px;
          line-height: 1.35;
        }

        .dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 10px 0;
        }

        .die {
          width: 31px;
          height: 31px;
          border-radius: 6px;
          border: 1px solid #555;
          display: inline-grid;
          place-items: center;
          font-weight: 700;
          font-size: 14px;
          background: #090909;
          color: #f3f3f3;
        }

        .die-success,
        .die-critical {
          color: #101810;
          background: #36d675;
          border-color: #6df0a0;
          box-shadow: 0 0 12px rgba(54, 214, 117, 0.2);
        }

        .die-critical {
          outline: 2px solid #f2ff7a;
        }

        .die-botch {
          border-color: #f3f3f3;
          color: #fff;
        }

        .roll-card footer strong {
          color: #36d675;
          font-size: 18px;
        }

        @media (max-width: 1040px) {
          html,
          body {
            overflow: auto !important;
          }

          .table-page-shell {
            padding: 14px 10px;
          }

          .table-layout {
            grid-template-columns: 1fr;
            height: auto;
          }

          .play-surface {
            height: 68vh;
          }

          .right-rail {
            grid-template-rows: 360px 440px;
          }

          .table-topbar {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}

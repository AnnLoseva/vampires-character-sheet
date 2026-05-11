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

type TableImage = {
  id: string
  room: string
  name: string
  imageData: string
  createdAt: string
}

type TableImageRow = {
  id: string
  room: string
  name: string
  image_data: string
  created_at: string
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

function mergeImage(images: TableImage[], image: TableImage) {
  if (images.some(item => item.id === image.id)) return images
  return [image, ...images].slice(0, 60)
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

function mapImageRow(row: TableImageRow): TableImage {
  return {
    id: row.id,
    room: row.room,
    name: row.name,
    imageData: row.image_data,
    createdAt: row.created_at,
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function VampireTable() {
  const [room, setRoom] = useState('campaign-666')
  const [rolls, setRolls] = useState<RollMessage[]>([])
  const [images, setImages] = useState<TableImage[]>([])
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [imageStatus, setImageStatus] = useState('Загрузка стола...')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      .select('id, room, name, image_data, created_at')
      .eq('room', currentRoom)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Не удалось загрузить картинки стола:', error)
          setImageStatus('Нет общей доски')
          return
        }

        setImages((data || []).map(row => mapImageRow(row as TableImageRow)))
        setImageStatus('Общая доска онлайн')
      })

    const channel = supabase
      .channel(`table-room:${currentRoom}`)
      .on('broadcast', { event: 'roll' }, payload => {
        const roll = payload.payload as RollMessage
        if (!roll || roll.room !== currentRoom) return
        setRolls(prev => mergeRoll(prev, roll))
        setConnectionText('Онлайн')
      })
      .on('broadcast', { event: 'image' }, payload => {
        const image = payload.payload as TableImage
        if (!image || image.room !== currentRoom) return
        setImages(prev => mergeImage(prev, image))
        setImageStatus('Общая доска онлайн')
      })
      .on('broadcast', { event: 'image-delete' }, payload => {
        const id = String((payload.payload as { id?: string })?.id || '')
        if (!id) return
        setImages(prev => prev.filter(image => image.id !== id))
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
          setImages(prev => mergeImage(prev, mapImageRow(payload.new as TableImageRow)))
          setImageStatus('Общая доска онлайн')
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
          if (deleted.id) setImages(prev => prev.filter(image => image.id !== deleted.id))
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnectionText('Онлайн')
        if (status === 'CHANNEL_ERROR') setConnectionText('Realtime недоступен')
        if (status === 'TIMED_OUT') setConnectionText('Повтор подключения')
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const latest = rolls[0]
  const totalDice = useMemo(() => rolls.reduce((sum, roll) => sum + roll.diceCount, 0), [rolls])

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      window.alert('Можно загрузить только картинку.')
      event.target.value = ''
      return
    }

    if (file.size > 2_500_000) {
      window.alert('Пока лучше загружать картинки до 2.5 МБ. Большие карты позже вынесем в Storage.')
      event.target.value = ''
      return
    }

    setIsUploading(true)

    try {
      const supabase = createClient()
      const image: TableImage = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        room,
        name: file.name,
        imageData: await readFileAsDataUrl(file),
        createdAt: new Date().toISOString(),
      }

      const { error } = await supabase.from(TABLE_IMAGES).insert({
        id: image.id,
        room: image.room,
        name: image.name,
        image_data: image.imageData,
        created_at: image.createdAt,
      })

      const channel = supabase.channel(`table-room:${room}`)
      await channel.subscribe()
      await channel.send({ type: 'broadcast', event: 'image', payload: image })
      await supabase.removeChannel(channel)

      if (error) {
        console.error('Не удалось сохранить картинку стола:', error)
        setImages(prev => mergeImage(prev, image))
        setImageStatus('Картинка показана онлайн, но не сохранена')
        window.alert('Картинка отправлена онлайн, но не сохранилась в историю. Нужно создать table_images в Supabase.')
        return
      }

      setImages(prev => mergeImage(prev, image))
      setImageStatus('Общая доска онлайн')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const deleteImage = async (imageId: string) => {
    if (!window.confirm('Убрать картинку со стола?')) return

    setImages(prev => prev.filter(image => image.id !== imageId))

    const supabase = createClient()
    await supabase.from(TABLE_IMAGES).delete().eq('id', imageId)
    const channel = supabase.channel(`table-room:${room}`)
    await channel.subscribe()
    await channel.send({ type: 'broadcast', event: 'image-delete', payload: { id: imageId, room } })
    await supabase.removeChannel(channel)
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
            {isUploading ? 'Загрузка...' : 'Картинка'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} />
        </div>
      </section>

      <section className="table-layout">
        <section className="play-surface" aria-label="Игровой стол с картинками">
          <header className="surface-head">
            <div>
              <span>{imageStatus}</span>
              <strong>{images.length ? `${images.length} изображ.` : 'Пустой стол'}</strong>
            </div>
            <div>
              <span>Связь</span>
              <strong>{connectionText}</strong>
            </div>
          </header>

          <div className="image-board">
            {images.length === 0 ? (
              <div className="image-empty">
                <h2>Загрузи первую картинку</h2>
                <p>Карты, сцены и портреты появятся у всех игроков в этой комнате.</p>
              </div>
            ) : (
              images.map(image => (
                <figure className="table-image" key={image.id}>
                  <img src={image.imageData} alt={image.name} />
                  <figcaption>
                    <span>{image.name}</span>
                    <button type="button" onClick={() => deleteImage(image.id)} title="Убрать картинку">
                      x
                    </button>
                  </figcaption>
                </figure>
              ))
            )}
          </div>
        </section>

        <aside className="roll-sidebar" aria-label="История бросков">
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
              <p className="roll-empty">Бросков пока нет.</p>
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
          overflow-x: hidden !important;
        }
      `}</style>
      <style jsx>{`
        .table-page-shell {
          min-height: 100vh;
          padding: 22px;
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
          margin: 0 auto 18px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 14px;
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
          font-size: clamp(28px, 4vw, 48px);
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
        .table-actions button {
          border: 1px solid #773030;
          background: #141414;
          color: #f5f5f5;
          border-radius: 6px;
          padding: 10px 14px;
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
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 14px;
          height: calc(100vh - 126px);
          min-height: 560px;
        }

        .play-surface {
          min-width: 0;
          border: 1px solid #2b2b2b;
          background: #0f0f0f;
          border-radius: 8px;
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }

        .surface-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .surface-head div {
          display: grid;
          gap: 4px;
        }

        .surface-head span,
        .roll-sidebar header span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .surface-head strong,
        .roll-sidebar header strong {
          color: #f5f5f5;
          font-size: 15px;
        }

        .image-board {
          min-height: 0;
          overflow: auto;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          align-content: start;
          gap: 14px;
        }

        .image-empty {
          grid-column: 1 / -1;
          min-height: 430px;
          display: grid;
          place-content: center;
          text-align: center;
          color: #aaa;
          border: 1px dashed #3a3a3a;
          border-radius: 8px;
          background: #0b0b0b;
        }

        .image-empty h2 {
          margin: 0 0 8px;
          color: #fff;
          letter-spacing: 0;
          text-transform: none;
          border: 0;
          padding: 0;
        }

        .image-empty p {
          margin: 0;
          max-width: 430px;
        }

        .table-image {
          margin: 0;
          border: 1px solid #333;
          border-radius: 8px;
          background: #151515;
          overflow: hidden;
        }

        .table-image img {
          display: block;
          width: 100%;
          max-height: 520px;
          object-fit: contain;
          background: #050505;
        }

        .table-image figcaption {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 9px 10px;
          color: #bbb;
          font-size: 12px;
          border-top: 1px solid #292929;
        }

        .table-image figcaption span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .table-image figcaption button {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid #663;
          background: #1c1c1c;
          color: #ff6666;
          cursor: pointer;
        }

        .roll-sidebar {
          min-width: 0;
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }

        .roll-sidebar header {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .roll-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-right: 1px solid #292929;
        }

        .roll-sidebar header div:last-child {
          border-right: none;
        }

        .roll-sidebar header strong {
          color: #36d675;
          font-size: 20px;
        }

        .roll-list {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .roll-empty {
          margin: auto;
          color: #888;
          text-align: center;
          font-size: 13px;
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

        @media (max-width: 940px) {
          .table-page-shell {
            padding: 14px 10px;
          }

          .table-layout {
            grid-template-columns: 1fr;
            height: auto;
          }

          .roll-sidebar {
            min-height: 420px;
          }

          .table-topbar {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}

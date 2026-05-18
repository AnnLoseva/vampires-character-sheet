import type { Dispatch, DragEvent, FormEvent, RefObject, SetStateAction } from 'react'
import type { LeftToolbarTab, SceneMusicTrack, TableScene } from '@/lib/table/types'

type SceneManagerProps = {
  leftToolbarTab: LeftToolbarTab
  activeScene: TableScene | null | undefined
  selectedScene: TableScene | null | undefined
  sceneStatus: string
  scenes: TableScene[]
  selectedSceneMusic: SceneMusicTrack[]
  room: string
  sceneMusicDraft: string
  isUploading: boolean
  sceneMusicFileInputRef: RefObject<HTMLInputElement | null>
  createScene: () => Promise<void>
  renameScene: () => Promise<void>
  deleteScene: () => Promise<void>
  activateScene: (sceneId: string) => Promise<void>
  loadSceneMusic: (targetRoom: string, sceneId: string) => Promise<void>
  setSelectedSceneId: Dispatch<SetStateAction<string | null>>
  handleSceneMusicDrop: (event: DragEvent<HTMLElement>) => Promise<void>
  addSceneMusic: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setSceneMusicDraft: Dispatch<SetStateAction<string>>
  reorderSceneMusic: (track: SceneMusicTrack, direction: 'up' | 'down') => Promise<void>
  publishSceneTrack: (track: SceneMusicTrack, options?: { play?: boolean }) => void
  patchSceneMusic: (track: SceneMusicTrack, patch: Partial<Pick<SceneMusicTrack, 'title' | 'orderIndex' | 'isDefault' | 'autoplay'>>) => Promise<void>
  renameSceneMusic: (track: SceneMusicTrack) => Promise<void>
  deleteSceneMusic: (track: SceneMusicTrack) => Promise<void>
}

export default function SceneManager({
  leftToolbarTab,
  activeScene,
  selectedScene,
  sceneStatus,
  scenes,
  selectedSceneMusic,
  room,
  sceneMusicDraft,
  isUploading,
  sceneMusicFileInputRef,
  createScene,
  renameScene,
  deleteScene,
  activateScene,
  loadSceneMusic,
  setSelectedSceneId,
  handleSceneMusicDrop,
  addSceneMusic,
  setSceneMusicDraft,
  reorderSceneMusic,
  publishSceneTrack,
  patchSceneMusic,
  renameSceneMusic,
  deleteSceneMusic,
}: SceneManagerProps) {
  return (
    <section className={`scene-control-panel ${leftToolbarTab === 'scenes' ? '' : 'table-right-panel-hidden'}`}>
      <header>
        <div>
          <span>Активная сцена</span>
          <strong>{activeScene?.name || sceneStatus}</strong>
        </div>
      </header>
      <div className="scene-toolbar">
        <button type="button" onClick={() => void createScene()}>Создать</button>
        <button type="button" onClick={() => void renameScene()} disabled={!selectedScene}>Переименовать</button>
        <button type="button" onClick={() => void deleteScene()} disabled={!selectedScene || scenes.length <= 1}>Удалить</button>
      </div>
      <div className="scene-list">
        {scenes.length === 0 ? (
          <p className="panel-empty">Сцены пока не загружены.</p>
        ) : scenes.map(scene => (
          <article
            className={`scene-list-row ${scene.id === selectedScene?.id ? 'selected' : ''} ${scene.isActive ? 'active' : ''}`}
            key={scene.id}
            onClick={() => {
              setSelectedSceneId(scene.id)
              void loadSceneMusic(room, scene.id)
            }}
          >
            <div className="scene-thumb">
              {scene.thumbnailUrl ? <img src={scene.thumbnailUrl} alt="" /> : <span>{scene.name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div>
              <strong>{scene.name}</strong>
              <span>{scene.isActive ? 'сейчас на столе' : 'подготовлена'}</span>
            </div>
            <button type="button" disabled={scene.isActive} onClick={event => {
              event.stopPropagation()
              void activateScene(scene.id)
            }}>
              {scene.isActive ? 'Активна' : 'Включить'}
            </button>
          </article>
        ))}
      </div>
      <div className="scene-music-box">
        <header>
          <strong>Музыка сцены</strong>
          <span>{selectedSceneMusic.length ? `${selectedSceneMusic.length} треков` : 'мини-плейлист пуст'}</span>
        </header>
        <div
          className="scene-music-actions"
          onDragOver={event => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDrop={handleSceneMusicDrop}
        >
          <button type="button" onClick={() => sceneMusicFileInputRef.current?.click()} disabled={!selectedScene || isUploading}>
            Загрузить песню
          </button>
          <span>Можно перетащить аудио сюда</span>
        </div>
        <form className="media-url-form" onSubmit={addSceneMusic}>
          <input
            value={sceneMusicDraft}
            onChange={event => setSceneMusicDraft(event.target.value)}
            placeholder="YouTube-ссылки через пробел"
          />
          <button type="submit" disabled={!sceneMusicDraft.trim() || !selectedScene}>Добавить</button>
        </form>
        <div className="scene-track-list">
          {selectedSceneMusic.map(track => (
            <article className="scene-track-row" key={track.id}>
              <div>
                <strong>{track.title}</strong>
                <span>{track.isDefault ? 'по умолчанию' : track.sourceType}{track.autoplay ? ' · автозапуск' : ''}</span>
              </div>
              <button type="button" onClick={() => void reorderSceneMusic(track, 'up')}>↑</button>
              <button type="button" onClick={() => void reorderSceneMusic(track, 'down')}>↓</button>
              <button type="button" onClick={() => publishSceneTrack(track, { play: true })}>▶</button>
              <button type="button" onClick={() => void patchSceneMusic(track, { isDefault: true })}>★</button>
              <button type="button" onClick={() => void patchSceneMusic(track, { autoplay: !track.autoplay })}>{track.autoplay ? 'A' : 'a'}</button>
              <button type="button" onClick={() => void renameSceneMusic(track)}>T</button>
              <button type="button" className="danger" onClick={() => void deleteSceneMusic(track)}>×</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

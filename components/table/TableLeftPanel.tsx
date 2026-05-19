import type { Dispatch, ReactNode, SetStateAction } from 'react'

type TableLeftPanelProps = {
  isMaster: boolean
  musicPanelOpen: boolean
  leftPanelOpen: boolean
  setMusicPanelOpen: Dispatch<SetStateAction<boolean>>
  setLeftPanelOpen: Dispatch<SetStateAction<boolean>>
  musicPanel: ReactNode
  children: ReactNode
}

export default function TableLeftPanel({
  isMaster,
  musicPanelOpen,
  leftPanelOpen,
  setMusicPanelOpen,
  setLeftPanelOpen,
  musicPanel,
  children,
}: TableLeftPanelProps) {
  return (
    <>
      {isMaster ? (
        <>
          <aside className={`music-dock ${musicPanelOpen ? '' : 'panel-collapsed'}`} aria-label="Музыка комнаты">
            {musicPanel}
          </aside>
          <button
            type="button"
            className="column-edge-toggle music-toggle"
            onClick={() => setMusicPanelOpen(prev => !prev)}
            aria-label={musicPanelOpen ? 'Скрыть музыку' : 'Показать музыку'}
            title={musicPanelOpen ? 'Скрыть музыку' : 'Показать музыку'}
          >
            <span />
            <span />
            <span />
          </button>
        </>
      ) : null}
      {isMaster ? (
        <button
          type="button"
          className="column-edge-toggle master-toggle"
          onClick={() => setLeftPanelOpen(prev => !prev)}
          aria-label={leftPanelOpen ? 'Скрыть сцены' : 'Показать сцены'}
          title={leftPanelOpen ? 'Скрыть сцены' : 'Показать сцены'}
        >
          <span />
          <span />
          <span />
        </button>
      ) : null}
      {children}
    </>
  )
}

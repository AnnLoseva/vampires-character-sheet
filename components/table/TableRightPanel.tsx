import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { RightRailTab } from '@/lib/table/types'

type TableRightPanelProps = {
  isMaster: boolean
  rightPanelOpen: boolean
  rightRailTab: RightRailTab
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  setRightRailTab: Dispatch<SetStateAction<RightRailTab>>
  children: ReactNode
}

export default function TableRightPanel({
  isMaster,
  rightPanelOpen,
  rightRailTab,
  setRightPanelOpen,
  setRightRailTab,
  children,
}: TableRightPanelProps) {
  return (
    <>
      <button
        type="button"
        className="column-edge-toggle right-toggle"
        onClick={() => setRightPanelOpen(prev => !prev)}
        aria-label={rightPanelOpen ? 'Скрыть правую панель' : 'Показать правую панель'}
        title={rightPanelOpen ? 'Скрыть правую панель' : 'Показать правую панель'}
      >
        <span />
        <span />
        <span />
      </button>
      {rightPanelOpen ? <aside className="right-rail">
        <nav className="right-tabs" aria-label="Панели стола">
          {!isMaster ? (
            <button
              type="button"
              className={rightRailTab === 'media' ? 'active' : ''}
              onClick={() => setRightRailTab('media')}
            >
              Медиа
            </button>
          ) : null}
          <button
            type="button"
            className={rightRailTab === 'rolls' ? 'active' : ''}
            onClick={() => setRightRailTab('rolls')}
          >
            Броски
          </button>
          <button
            type="button"
            className={rightRailTab === 'chat' ? 'active' : ''}
            onClick={() => setRightRailTab('chat')}
          >
            Чат
          </button>
          <button
            type="button"
            className={rightRailTab === 'diary' ? 'active' : ''}
            onClick={() => setRightRailTab('diary')}
          >
            {isMaster ? 'Персонажи' : 'Дневник'}
          </button>
          <button
            type="button"
            className={rightRailTab === 'master' ? 'active' : ''}
            onClick={() => setRightRailTab('master')}
          >
            Мастер
          </button>
        </nav>
        {children}
      </aside> : null}
    </>
  )
}

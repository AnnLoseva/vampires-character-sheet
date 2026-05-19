import type { Dispatch, SetStateAction } from 'react'

type TableLeftPanelProps = {
  isMaster: boolean
  leftPanelOpen: boolean
  setLeftPanelOpen: Dispatch<SetStateAction<boolean>>
  children: React.ReactNode
}

export default function TableLeftPanel({
  isMaster,
  leftPanelOpen,
  setLeftPanelOpen,
  children,
}: TableLeftPanelProps) {
  return (
    <>
      {/* Placeholder column — keeps the CSS grid slot for the (always-collapsed) music dock */}
      <aside className="music-dock panel-collapsed" aria-hidden="true" />
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

type MasterConsoleTopbarProps = {
  room: string
  onLock: () => void
}

export default function MasterConsoleTopbar({ room, onLock }: MasterConsoleTopbarProps) {
  return (
    <header className="master-console-topbar">
      <div>
        <span>Пульт рассказчика · V5</span>
        <strong>{room}</strong>
      </div>
      <div className="master-console-statuses" aria-label="Состояние пульта">
        <span className="master-console-sync">● Локальный каркас</span>
        <span className="master-console-role">Мастер</span>
        <button type="button" onClick={onLock}>Заблокировать</button>
      </div>
    </header>
  )
}

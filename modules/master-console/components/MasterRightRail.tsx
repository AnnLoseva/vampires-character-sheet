'use client'

import type { MasterRollRequest } from '../types'

type MasterRightRailProps = {
  rollRequest: MasterRollRequest | null
  onClearRollRequest?: () => void
}

export default function MasterRightRail({ rollRequest, onClearRollRequest }: MasterRightRailProps) {
  return (
    <aside className="master-right-rail" aria-label="Инструменты рассказчика">
      <section>
        <h2>Роллер мастера</h2>
        {rollRequest ? (
          <div className="master-roll-target">
            <p>
              <strong>☾ {rollRequest.displayName}</strong>
            </p>
            <p className="actors-muted">
              {rollRequest.mode === 'rouse' ? 'Rouse Check' : 'Пул'}
              {rollRequest.traits.length ? ` · ${rollRequest.traits.join(' + ')}` : ''}
              {' · '}{rollRequest.dice}к · Голод {rollRequest.hunger}
            </p>
            <p className="actors-muted">
              Полный роллер подключится в фазе master-rolls. Запрос уже типизирован и готов к общему API бросков.
            </p>
            {onClearRollRequest ? (
              <button type="button" onClick={onClearRollRequest}>Сбросить цель</button>
            ) : null}
          </div>
        ) : (
          <p>Выберите актёра и нажмите «🎲 пул» или «Rouse» в модуле НПС.</p>
        )}
      </section>
      <section>
        <h2>Последние действия</h2>
        <p>Действий пока нет. Массовые операции НПС пишут в master_action_log при доступной Auth/schema.</p>
      </section>
      <section>
        <h2>Предупреждения</h2>
        <p className="master-console-ok">Нет активных предупреждений.</p>
      </section>
    </aside>
  )
}

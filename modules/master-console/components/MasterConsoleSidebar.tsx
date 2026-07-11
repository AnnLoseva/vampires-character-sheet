'use client'

import { MASTER_CONSOLE_CONTRIBUTIONS } from '../contributions'

type MasterConsoleSidebarProps = {
  activeModuleId: string
  onSelectModule: (id: string) => void
  actorCount?: number
}

const PLACEHOLDER_MODULES = [
  { id: 'overview', icon: '◈', title: 'Обзор ночи' },
  { id: 'scenes', icon: '▣', title: 'Сцены и слои' },
  { id: 'lore', icon: '✎', title: 'Лор и таблицы' },
  { id: 'blood-bonds', icon: '∞', title: 'Узы крови' },
  { id: 'session-log', icon: '☰', title: 'Журнал сессии' },
] as const

export default function MasterConsoleSidebar({
  activeModuleId,
  onSelectModule,
  actorCount,
}: MasterConsoleSidebarProps) {
  const registered = new Map(MASTER_CONSOLE_CONTRIBUTIONS.map(item => [item.id, item]))

  const modules = [
    ...PLACEHOLDER_MODULES.filter(item => !registered.has(item.id)).map(item => ({
      ...item,
      enabled: false as const,
      badge: undefined as string | undefined,
    })),
    ...MASTER_CONSOLE_CONTRIBUTIONS.map(item => ({
      id: item.id,
      icon: item.icon,
      title: item.shortTitle || item.title,
      enabled: true as const,
      badge: item.id === 'actors' && typeof actorCount === 'number' ? String(actorCount) : undefined,
    })),
  ].sort((a, b) => {
    const productOrder = ['overview', 'actors', 'scenes', 'lore', 'blood-bonds', 'session-log']
    const indexA = productOrder.indexOf(a.id)
    const indexB = productOrder.indexOf(b.id)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  return (
    <aside className="master-console-sidebar" aria-label="Навигация пульта">
      <section>
        <h2>Макросы</h2>
        <p>Макросы появятся в отдельной фазе.</p>
      </section>
      <section>
        <h2>Модули</h2>
        <ul>
          {modules.map(item => (
            <li key={item.id} data-active={activeModuleId === item.id ? 'true' : undefined}>
              {item.enabled ? (
                <button type="button" onClick={() => onSelectModule(item.id)}>
                  <span>{item.icon} {item.title}</span>
                  {item.badge ? <em>{item.badge}</em> : null}
                </button>
              ) : (
                <span className="master-module-disabled" title="Будет в следующей фазе">
                  {item.icon} {item.title}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Раскладки</h2>
        <p>Раскладки пока не настроены.</p>
      </section>
    </aside>
  )
}

'use client'

export type ReferenceHeading = {
  id: string
  title: string
  level: 2 | 3
}

type ReferenceSidebarProps = {
  headings: ReferenceHeading[]
}

export default function ReferenceSidebar({ headings }: ReferenceSidebarProps) {
  return (
    <aside className="reference-sidebar" aria-label="Оглавление справочника">
      <div className="reference-sidebar-inner">
        <span>Оглавление</span>
        <nav>
          {headings.length === 0 ? (
            <p>Заголовки загружаются...</p>
          ) : headings.map(heading => (
            <a className={`level-${heading.level}`} href={`#${heading.id}`} key={`${heading.id}-${heading.title}`}>
              {heading.title}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}

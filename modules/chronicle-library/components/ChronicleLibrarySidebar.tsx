import type { ReferenceHeading } from '@/modules/reference/utils/markdown'
import type { ChronicleDocument, LibraryChronicle } from '../types'

type ChronicleLibrarySidebarProps = {
  chronicles: LibraryChronicle[]
  activeChronicle: LibraryChronicle | null
  documents: ChronicleDocument[]
  activeDocument: ChronicleDocument | null
  headings: ReferenceHeading[]
  onSelectChronicle: (chronicleId: string) => void
  onSelectDocument: (sourceName: string) => void
  labels: {
    chronicles: string
    documents: string
    headings: string
    noDocuments: string
  }
}

export default function ChronicleLibrarySidebar({
  chronicles,
  activeChronicle,
  documents,
  activeDocument,
  headings,
  onSelectChronicle,
  onSelectDocument,
  labels,
}: ChronicleLibrarySidebarProps) {
  return (
    <aside className="chronicle-sidebar" aria-label={labels.chronicles}>
      <div className="chronicle-sidebar-inner">
        <section className="chronicle-sidebar-section">
          <span>{labels.chronicles}</span>
          <nav className="chronicle-doc-nav">
            {chronicles.map(chronicle => (
              <button
                type="button"
                className={`chronicle-doc-link ${activeChronicle?.id === chronicle.id ? 'active' : ''}`}
                key={chronicle.id}
                onClick={() => onSelectChronicle(chronicle.id)}
              >
                <strong>{chronicle.title}</strong>
              </button>
            ))}
          </nav>
        </section>

        {activeChronicle ? (
          <section className="chronicle-sidebar-section">
            <span>{labels.documents}</span>
            <nav className="chronicle-doc-nav">
              {documents.length === 0 ? <small>{labels.noDocuments}</small> : null}
              {documents.map(document => (
                <button
                  type="button"
                  className={`chronicle-doc-link ${activeDocument?.sourceName === document.sourceName ? 'active' : ''}`}
                  key={document.sourceName}
                  onClick={() => onSelectDocument(document.sourceName)}
                >
                  <strong>{document.title}</strong>
                  <small>{document.sourceName}</small>
                </button>
              ))}
            </nav>
          </section>
        ) : null}

        {headings.length > 0 ? (
          <section className="chronicle-sidebar-section">
            <span>{labels.headings}</span>
            <nav className="chronicle-heading-nav">
              {headings.map(heading => (
                <a className={`level-${heading.level}`} href={`#${heading.id}`} key={heading.id}>
                  {heading.title}
                </a>
              ))}
            </nav>
          </section>
        ) : null}
      </div>
    </aside>
  )
}

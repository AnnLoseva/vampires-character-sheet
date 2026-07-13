export type LibraryChronicle = {
  id: string
  title: string
  joined_at: string
  last_opened_at: string
}

export type ChronicleChunkRow = {
  source_name: string
  document_title: string
  section_title: string
  chunk_index: number
  content: string
}

export type ChronicleDocumentChunk = {
  sectionTitle: string
  chunkIndex: number
  content: string
}

export type ChronicleDocument = {
  sourceName: string
  title: string
  markdown: string
  chunks: ChronicleDocumentChunk[]
}

export type ChronicleUploadChunk = {
  section_title: string
  content: string
}

export type ParsedChronicleUpload = {
  documentTitle: string
  chunks: ChronicleUploadChunk[]
}

export type ChronicleSearchHit = {
  sourceName: string
  documentTitle: string
  sectionTitle: string
  chunkIndex: number
  slug: string
  snippet: string
}

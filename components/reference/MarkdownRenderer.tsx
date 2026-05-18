'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

type MarkdownRendererProps = {
  markdown: string
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  return (
    <article className="reference-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel={props.href?.startsWith('http') ? 'noreferrer' : undefined}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="reference-table-wrap">
              <table>{children}</table>
            </div>
          ),
          input: ({ ...props }) => <input {...props} disabled />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
}

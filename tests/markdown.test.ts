import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/lib/markdown'

describe('renderMarkdown', () => {
  it('renders highlight syntax without changing normal Markdown', () => {
    const html = renderMarkdown('A ==highlighted== **word**')

    expect(html).toContain('<mark>highlighted</mark>')
    expect(html).toContain('<strong>word</strong>')
  })

  it('encodes mathematical source before inserting it into an attribute', () => {
    const html = renderMarkdown('$a < b$')

    expect(html).toContain('data-math="a%20%26lt%3B%20b"')
    expect(html).toContain('a &lt; b')
  })
})

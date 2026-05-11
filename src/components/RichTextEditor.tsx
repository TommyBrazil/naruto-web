'use client'

import React, { useEffect, useRef, useState } from 'react'

const COLOURS = [
  { hex: '#ff0000', label: 'Red — danger/villains' },
  { hex: '#c8a96e', label: 'Gold — important' },
  { hex: '#5a9e5a', label: 'Green — allies' },
  { hex: '#4a9ef0', label: 'Blue — locations' },
  { hex: '#9b59b6', label: 'Purple — mysteries' },
  { hex: '#ff6600', label: 'Orange — warnings' },
]

interface RichTextEditorProps {
  initialValue: string
  onChange: (html: string) => void
  placeholder?: string
  allCFs: { id: string; name: string; tag: string }[]
}

export default function RichTextEditor({
  initialValue,
  onChange,
  placeholder,
  allCFs,
}: RichTextEditorProps) {
  const editorRef        = useRef<HTMLDivElement>(null)
  const saveTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedSelectionRef = useRef<Range | null>(null)
  const [showColours,  setShowColours]  = useState(false)
  const [showCFSearch, setShowCFSearch] = useState(false)
  const [cfSearch,     setCFSearch]     = useState('')

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (savedSelectionRef.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedSelectionRef.current)
    }
  }

  // Set content on mount only
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue || ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function triggerSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML)
    }, 800)
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(cmd, false, val)
    triggerSave()
  }

  function applyColour(hex: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand('foreColor', false, hex)
    setShowColours(false)
    triggerSave()
  }

  function insertCFLink(cf: { id: string; name: string }) {
    restoreSelection()
    editorRef.current?.focus()
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // Text is selected — wrap the selection in the link span, keeping the selected text
      const selectedText = selection.toString()
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const span = document.createElement('span')
      span.setAttribute('data-cf-id', cf.id)
      span.setAttribute('contenteditable', 'false')
      span.setAttribute('onclick', `window.__cfNavigate?.('${cf.id}')`)
      span.style.cssText = 'color:var(--primary);text-decoration:underline;text-decoration-style:dotted;cursor:pointer;font-weight:600'
      span.textContent = selectedText
      range.insertNode(span)
      selection.removeAllRanges()
    } else {
      // No selection — insert the case file name as the link text
      const html = `<span data-cf-id="${cf.id}" style="color:var(--primary);text-decoration:underline;text-decoration-style:dotted;cursor:pointer;font-weight:600" contenteditable="false" onclick="window.__cfNavigate?.('${cf.id}')">${cf.name}</span>&nbsp;`
      document.execCommand('insertHTML', false, html)
    }

    setCFSearch('')
    setShowCFSearch(false)
    triggerSave()
  }

  const cfResults = cfSearch.trim()
    ? allCFs.filter(cf => cf.name.toLowerCase().includes(cfSearch.toLowerCase())).slice(0, 8)
    : []

  function TbBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onClick() }}
        title={title}
        className="px-2 py-1 rounded text-xs font-medium hover:bg-white/10 transition-colors flex-shrink-0"
        style={{ color: 'var(--foreground)' }}>
        {children}
      </button>
    )
  }

  return (
    <div className="rounded-xl border overflow-visible" style={{ borderColor: 'var(--border)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
        style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
        <TbBtn onClick={() => exec('bold')}      title="Bold"><b>B</b></TbBtn>
        <TbBtn onClick={() => exec('italic')}    title="Italic"><i>I</i></TbBtn>
        <TbBtn onClick={() => exec('underline')} title="Underline"><u>U</u></TbBtn>
        <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: 'var(--border)' }} />
        <TbBtn onClick={() => exec('insertUnorderedList')} title="Bullet list">• List</TbBtn>
        <TbBtn onClick={() => exec('insertOrderedList')}   title="Numbered list">1. List</TbBtn>
        <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: 'var(--border)' }} />

        {/* Colour picker */}
        <div className="relative flex-shrink-0">
          <button
            onMouseDown={e => { e.preventDefault(); setShowColours(v => !v); setShowCFSearch(false) }}
            className="px-2 py-1 rounded text-xs hover:bg-white/10 flex items-center gap-1"
            style={{ color: 'var(--foreground)' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ff0000' }} />
            <span>A</span>
          </button>
          {showColours && (
            <div className="absolute z-30 top-full left-0 mt-1 p-2 rounded-xl border flex gap-1.5 shadow-lg"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {COLOURS.map(c => (
                <button key={c.hex} title={c.label}
                  onMouseDown={e => { e.preventDefault(); applyColour(c.hex) }}
                  className="w-6 h-6 rounded hover:scale-125 transition-transform flex-shrink-0"
                  style={{ background: c.hex, border: '2px solid transparent' }} />
              ))}
              <button
                title="Remove colour"
                onMouseDown={e => { e.preventDefault(); exec('removeFormat'); setShowColours(false) }}
                className="w-6 h-6 rounded text-[9px] hover:opacity-70 flex-shrink-0"
                style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}>✕</button>
            </div>
          )}
        </div>

        <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: 'var(--border)' }} />

        {/* CF link */}
        <div className="relative flex-shrink-0">
          <button
            onMouseDown={e => { e.preventDefault(); saveSelection(); setShowCFSearch(v => !v); setShowColours(false) }}
            className="px-2 py-1 rounded text-xs hover:bg-white/10"
            style={{ color: 'var(--primary)' }}
            title="Link to case file">
            @ Link
          </button>
          {showCFSearch && (
            <div className="absolute z-30 top-full left-0 mt-1 rounded-xl border shadow-lg"
              style={{ width: '220px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <input type="text" value={cfSearch} onChange={e => setCFSearch(e.target.value)}
                placeholder="Search case files…"
                className="w-full px-3 py-2 text-xs rounded-t-xl"
                style={{ borderBottom: `1px solid var(--border)`, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}
                autoFocus />
              <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                {cfResults.map(cf => (
                  <button key={cf.id}
                    onMouseDown={e => { e.preventDefault(); insertCFLink(cf) }}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 flex items-center gap-2"
                    style={{ color: 'var(--foreground)' }}>
                    <span className="font-eyebrow text-[8px]" style={{ color: 'var(--muted-foreground)' }}>{cf.tag}</span>
                    {cf.name}
                  </button>
                ))}
                {cfSearch.trim() && cfResults.length === 0 && (
                  <div className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>No results</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={triggerSave}
        onKeyDown={e => {
          if (e.key === 'Escape') { setShowColours(false); setShowCFSearch(false) }
        }}
        onClick={() => { setShowColours(false); setShowCFSearch(false) }}
        className="min-h-[100px] p-3 text-sm leading-relaxed focus:outline-none"
        style={{ color: 'var(--foreground)', background: 'var(--surface)' }}
        data-placeholder={placeholder || 'Add notes…'}
      />
      <style>{`[contenteditable][data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--muted-foreground);pointer-events:none}`}</style>
    </div>
  )
}

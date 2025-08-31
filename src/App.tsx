import { createSignal, createMemo, onMount, For, createEffect } from 'solid-js'
import type { Note, NoteType, Group, DbNote, OutboxItem } from './types'
import { db } from './db'
import { runSyncOnce, subscribeRealtime } from './sync'

function App() {
  const [notes, setNotes] = createSignal<Note[]>([])
  const [groups, setGroups] = createSignal<Group[]>([])
  const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null | undefined>(undefined)
  const [searchQuery] = createSignal('')
  const [sidebarWidth, setSidebarWidth] = createSignal(320) // Default width 320px
  const [isResizing, setIsResizing] = createSignal(false)
  const [sidebarVisible, setSidebarVisible] = createSignal(true) // Control sidebar visibility
  const [dropdownOpen, setDropdownOpen] = createSignal(false) // Control dropdown visibility
  const [contextMenu, setContextMenu] = createSignal<{visible: boolean, x: number, y: number, noteId: string | null}>({
    visible: false,
    x: 0,
    y: 0,
    noteId: null
  }) // Control context menu
  const [editorContextMenu, setEditorContextMenu] = createSignal<{visible: boolean, x: number, y: number}>({
    visible: false,
    x: 0,
    y: 0
  }) // Editor context menu
  const [filterType, setFilterType] = createSignal<'all' | NoteType | 'favorites'>('all') // Note filter
  const [filtersVisible, setFiltersVisible] = createSignal(false) // Control filter visibility
  const [contentPanelWidth] = createSignal(280) // Content panel width
  const [editingGroupId, setEditingGroupId] = createSignal<string | null>(null) // Currently editing folder id
  const [folderPanelEditingTitle, setFolderPanelEditingTitle] = createSignal<string>('') // Title being edited in folder panel
  const [isFolderPanelEditing, setIsFolderPanelEditing] = createSignal(false) // Whether folder panel title is being edited
  const [draggedGroupId, setDraggedGroupId] = createSignal<string | null>(null) // Currently dragged folder id
  const [insertIndex, setInsertIndex] = createSignal<number | null>(null) // Global insert index
  const [isMainModalOpen, setIsMainModalOpen] = createSignal(false)
  const [activeModalTab, setActiveModalTab] = createSignal<'account' | 'settings'>('account')
  const [leftListFilter, setLeftListFilter] = createSignal<'all' | 'ungrouped'>('all')
  const [leftListDropdownOpen, setLeftListDropdownOpen] = createSignal(false)
  const [leftListSortOpen, setLeftListSortOpen] = createSignal(false)
  const [leftListSortKey, setLeftListSortKey] = createSignal<'updated' | 'created' | 'title'>('updated')
  const [leftListSortOrder, setLeftListSortOrder] = createSignal<'asc' | 'desc'>('desc')
  const [leftListPinnedFirst, setLeftListPinnedFirst] = createSignal(true)
  const [isSearchModalOpen, setIsSearchModalOpen] = createSignal(false)
  const [searchModalQuery, setSearchModalQuery] = createSignal('')
  const searchModalResults = createMemo(() => {
    const q = searchModalQuery().trim().toLowerCase()
    if (!q) return [] as Note[]
    const all = notes()
    const filtered = all.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      htmlToPlainText(n.content || '').toLowerCase().includes(q)
    )
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt)
  })
  let searchInputEl: HTMLInputElement | null = null
  let selectionRestored = false
  // Persist and restore last selected note and folder
  const saveSelectedNoteId = (id: string | null) => {
    try {
      if (id) localStorage.setItem('selectedNoteId', id)
      else localStorage.removeItem('selectedNoteId')
    } catch {}
  }
  const loadSelectedNoteId = (): string | null => {
    try { return localStorage.getItem('selectedNoteId') || null } catch { return null }
  }
  const saveSelectedGroupId = (gid: string | null | undefined) => {
    try {
      const v = gid === undefined ? '__UNDEF__' : gid === null ? '__NULL__' : gid
      localStorage.setItem('selectedGroupId', v as string)
    } catch {}
  }
  const loadSelectedGroupId = (): string | null | undefined => {
    try {
      const raw = localStorage.getItem('selectedGroupId')
      if (!raw) return undefined
      if (raw === '__UNDEF__') return undefined
      if (raw === '__NULL__') return null
      return raw
    } catch { return undefined }
  }
  const loadSpellcheckDisabled = (): boolean => {
    try {
      const stored = localStorage.getItem('disableSpellcheck')
      return stored ? stored === 'true' : true
    } catch {
      return true
    }
  }
  const saveSpellcheckDisabled = (value: boolean) => {
    try { localStorage.setItem('disableSpellcheck', value.toString()) } catch {}
  }
  const [spellcheckDisabled, setSpellcheckDisabled] = createSignal<boolean>(loadSpellcheckDisabled())
  let spellcheckObserver: MutationObserver | null = null
  const applySpellcheckToTree = (disable: boolean, root: ParentNode = document) => {
    const nodes = root.querySelectorAll('input, textarea, [contenteditable], [contenteditable="true"]')
    nodes.forEach((el) => {
      if (disable) {
        el.setAttribute('spellcheck', 'false')
        el.setAttribute('autocapitalize', 'off')
        el.setAttribute('autocorrect', 'off')
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.setAttribute('autocomplete', 'off')
      } else {
        el.setAttribute('spellcheck', 'true')
        el.removeAttribute('autocapitalize')
        el.removeAttribute('autocorrect')
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.setAttribute('autocomplete', 'on')
      }
    })
  }


  // Save to localStorage
  const saveToStorage = (notes: Note[]) => {
    localStorage.setItem('notes', JSON.stringify(notes))
  }

  // Save groups to localStorage
  const saveGroupsToStorage = (groups: Group[]) => {
    localStorage.setItem('groups', JSON.stringify(groups))
  }

  // Load from localStorage
  const loadFromStorage = (): Note[] => {
    try {
      const stored = localStorage.getItem('notes')
      if (!stored) return []
      
      const notes = JSON.parse(stored)
      // Migrate legacy notes and add new fields
      return notes.map((note: any) => ({
        ...note,
        type: note.type || 'normal',
        isFavorite: note.isFavorite || false,
        pinned: note.pinned || false,
        groupId: note.groupId || null
      }))
    } catch {
      return []
    }
  }

  // Load groups from localStorage
  const loadGroupsFromStorage = (): Group[] => {
    try {
      const stored = localStorage.getItem('groups')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  // Save sidebar width
  const saveSidebarWidth = (width: number) => {
    localStorage.setItem('sidebarWidth', width.toString())
  }

  // Load sidebar width
  const loadSidebarWidth = (): number => {
    try {
      const stored = localStorage.getItem('sidebarWidth')
      return stored ? parseInt(stored, 10) : 320
    } catch {
      return 320
    }
  }

  // Save sidebar visibility
  const saveSidebarVisible = (visible: boolean) => {
    localStorage.setItem('sidebarVisible', visible.toString())
  }

  // Load sidebar visibility
  const loadSidebarVisible = (): boolean => {
    try {
      const stored = localStorage.getItem('sidebarVisible')
      return stored ? stored === 'true' : true
    } catch {
      return true
    }
  }

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    const newVisible = !sidebarVisible()
    setSidebarVisible(newVisible)
    saveSidebarVisible(newVisible)
  }

  // Selection helpers to persist immediately
  const selectNote = (id: string | null) => {
    setSelectedNoteId(id)
    saveSelectedNoteId(id)
  }
  const selectGroup = (gid: string | null | undefined) => {
    setSelectedGroupId(gid)
    saveSelectedGroupId(gid)
  }

  // Persist selection changes (skip initial before restore)
  createEffect(() => {
    if (!selectionRestored) return
    saveSelectedNoteId(selectedNoteId())
  })
  createEffect(() => {
    if (!selectionRestored) return
    saveSelectedGroupId(selectedGroupId())
  })

  // Convert HTML to plain text (preserve line breaks)
  const htmlToPlainText = (html: string): string => {
    if (!html) return ''
    // Convert common block or line break tags to newline characters
    const normalized = html
      .replace(new RegExp('<\\s*br\\s*/?>', 'gi'), '\n')
      .replace(new RegExp('<\\s*/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\\s*>', 'gi'), '\n')
    const container = document.createElement('div')
    container.innerHTML = normalized
    const text = container.textContent || container.innerText || ''
    return text
  }

  // Compute note properties (based on plain text)
  const getNoteProperties = (note: Note) => {
    const raw = note.content || ''
    const contentText = htmlToPlainText(raw)
    const characters = contentText.length
    const sentences = contentText.split(/[.!?。！？]+/).filter(s => s.trim().length > 0).length
    const paragraphs = contentText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
    const createdAt = new Date(note.createdAt).toLocaleString('en-US')
    
    return {
      characters,
      sentences,
      paragraphs,
      createdAt
    }
  }

  // Count notes by type
  const noteStats = createMemo(() => {
    const allNotes = notes()
    return {
      all: allNotes.length,
      favorites: allNotes.filter(note => note.isFavorite).length,
      normal: allNotes.filter(note => note.type === 'normal').length,
      material: allNotes.filter(note => note.type === 'material').length,
      template: allNotes.filter(note => note.type === 'template').length
    }
  })

  // Sort helpers: pinned first, then newest updated
  const sortNotesByPinAndUpdated = (arr: Note[]) => {
    const keyed = [...arr].sort((a, b) => {
      // Pinned first (configurable)
      if (leftListPinnedFirst()) {
        const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
        if (pinDelta !== 0) return pinDelta
      }
      // Primary key
      const key = leftListSortKey()
      let delta = 0
      if (key === 'updated') delta = a.updatedAt - b.updatedAt
      else if (key === 'created') delta = a.createdAt - b.createdAt
      else {
        const at = (a.title || '').toLowerCase()
        const bt = (b.title || '').toLowerCase()
        delta = at < bt ? -1 : at > bt ? 1 : 0
      }
      if (leftListSortOrder() === 'desc') delta = -delta
      if (delta !== 0) return delta
      // Tie-breaker: updated desc
      return b.updatedAt - a.updatedAt
    })
    return keyed
  }

  // Filter notes
  const filteredNotes = createMemo(() => {
    let filtered = notes()
    
    // Filter by folder
    const groupId = selectedGroupId()
    if (groupId) {
      filtered = filtered.filter(note => note.groupId === groupId)
    } else if (groupId === null && selectedGroupId() !== undefined) {
      // Show ungrouped notes
      filtered = filtered.filter(note => !note.groupId)
    }
    
    // Filter by type
    const filter = filterType()
    if (filter === 'favorites') {
      filtered = filtered.filter(note => note.isFavorite)
    } else if (filter !== 'all') {
      filtered = filtered.filter(note => note.type === filter)
    }
    
    // Filter by search query
    const query = searchQuery().toLowerCase()
    if (query) {
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(query) || 
        note.content.toLowerCase().includes(query)
      )
    }
    
    return sortNotesByPinAndUpdated(filtered)
  })

  // Selected note
  const selectedNote = createMemo(() => {
    const id = selectedNoteId()
    return id ? notes().find(note => note.id === id) : null
  })

  // Create a new note
  const createNewNote = (type: NoteType = 'normal') => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type,
      isFavorite: false,
      pinned: false,
      groupId: selectedGroupId() || undefined
    }
    const updated = [newNote, ...notes()]
    setNotes(updated)
    selectNote(newNote.id)
    saveToStorage(updated)
    // Mirror to Dexie and enqueue outbox upsert
    const dbNote: DbNote = {
      id: newNote.id,
      title: newNote.title,
      content: newNote.content,
      createdAt: newNote.createdAt,
      updatedAt: newNote.updatedAt,
      type: newNote.type,
      isFavorite: newNote.isFavorite,
      pinned: newNote.pinned,
      groupId: newNote.groupId,
      version: 0,
      deletedAt: null
    }
    void db.notes.put(dbNote)
    const outboxItem: OutboxItem = {
      id: `${newNote.id}-create-${Date.now()}`,
      operation: 'upsert',
      noteId: newNote.id,
      payload: dbNote,
      createdAt: Date.now()
    }
    void db.outbox.add(outboxItem)
    
    // Delay to allow DOM update, then focus title
    setTimeout(() => {
      const titleInput = document.querySelector('input[placeholder="Note title..."]') as HTMLInputElement
      if (titleInput) {
        titleInput.focus()
        titleInput.select()
      }
    }, 10)
  }

  // Update note
  const updateNote = (id: string, updates: Partial<Note>) => {
    const updated = notes().map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: Date.now() }
        : note
    )
    setNotes(updated)
    saveToStorage(updated)
    // Mirror to Dexie and enqueue upsert
    const note = updated.find(n => n.id === id)
    if (note) {
      const dbNoteUpdate: Partial<DbNote> = {
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt,
        type: note.type,
        isFavorite: note.isFavorite,
        groupId: note.groupId
      }
      void db.notes.update(id, dbNoteUpdate)
      void db.outbox.add({
        id: `${id}-update-${Date.now()}`,
        operation: 'upsert',
        noteId: id,
        payload: { ...dbNoteUpdate },
        createdAt: Date.now()
      })
    }
  }

  // Delete note
  const deleteNote = (id: string) => {
    const updated = notes().filter(note => note.id !== id)
    setNotes(updated)
    if (selectedNoteId() === id) {
      selectNote(null)
    }
    saveToStorage(updated)
    // Mark deleted locally and enqueue delete
    void db.notes.update(id, { deletedAt: Date.now() })
    void db.outbox.add({
      id: `${id}-delete-${Date.now()}`,
      operation: 'delete',
      noteId: id,
      createdAt: Date.now()
    })
  }

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    const updated = notes().map(note => 
      note.id === id 
        ? { ...note, isFavorite: !note.isFavorite, updatedAt: Date.now() }
        : note
    )
    setNotes(updated)
    saveToStorage(updated)
  }

  // Change note type
  const changeNoteType = (id: string, type: NoteType) => {
    const updated = notes().map(note => 
      note.id === id 
        ? { ...note, type, updatedAt: Date.now() }
        : note
    )
    setNotes(updated)
    saveToStorage(updated)
  }

  // Create a new folder
  const createNewGroup = (name: string = 'New Folder', parentId?: string) => {
    const newGroup: Group = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId
    }
    const updated = [newGroup, ...groups()]
    setGroups(updated)
    saveGroupsToStorage(updated)
    
    // Enter edit mode automatically
    setEditingGroupId(newGroup.id)
    
    // Delay to allow DOM update, then select text
    setTimeout(() => {
      const input = document.querySelector(`input[data-group-id="${newGroup.id}"]`) as HTMLInputElement
      if (input) {
        input.focus()
        input.select()
      }
    }, 10)
    
    return newGroup.id
  }

  // Update folder name
  const updateGroup = (id: string, name: string) => {
    const updated = groups().map(group => 
      group.id === id 
        ? { ...group, name: name.trim() || 'New Folder', updatedAt: Date.now() }
        : group
    )
    setGroups(updated)
    saveGroupsToStorage(updated)
    setEditingGroupId(null)
  }

  // Realtime update folder name (used in folder panel)
  const updateGroupRealtime = (id: string, name: string) => {
    const updated = groups().map(group => 
      group.id === id 
        ? { ...group, name: name || 'New Folder', updatedAt: Date.now() }
        : group
    )
    setGroups(updated)
    saveGroupsToStorage(updated)
  }

  // Reorder (old API removed, handled by global insertIndex process)

  // Handle folder drag start
  const handleGroupDragStart = (e: DragEvent, groupId: string) => {
    setDraggedGroupId(groupId)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', groupId)
    }
  }

  const handleGroupDragOver = (e: DragEvent, groupId: string) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    const elementHeight = rect.height

    // Find current element index
    const currentIndex = groups().findIndex(g => g.id === groupId)
    if (currentIndex === -1) return

    // Upper half → insert at index; lower half → insert at index + 1
    const nextInsertIndex = relativeY < elementHeight / 2 ? currentIndex : currentIndex + 1
    setInsertIndex(nextInsertIndex)
  }

  const handleGroupDragLeave = () => {
    // Do not clear highlight immediately for smoother drag UX
  }

  const handleGroupDrop = (e: DragEvent) => {
    e.preventDefault()
    const draggedId = draggedGroupId()
    const targetIndex = insertIndex()
    if (!draggedId || targetIndex === null) {
      setDraggedGroupId(null)
      setInsertIndex(null)
      return
    }

    const current = groups()
    const fromIndex = current.findIndex(g => g.id === draggedId)
    if (fromIndex === -1) {
      setDraggedGroupId(null)
      setInsertIndex(null)
      return
    }

    // Adjust index: if moved from before, shift insert position left by one
    let toIndex = targetIndex
    if (fromIndex < targetIndex) toIndex = targetIndex - 1

    // Perform reorder
    const newGroups = [...current]
    const [moved] = newGroups.splice(fromIndex, 1)
    newGroups.splice(toIndex, 0, moved)
    setGroups(newGroups)
    saveGroupsToStorage(newGroups)

    setDraggedGroupId(null)
    setInsertIndex(null)
  }

  const handleGroupDragEnd = () => {
    setDraggedGroupId(null)
    setInsertIndex(null)
  }

  // Delete folder
  const deleteGroup = (id: string) => {
    // Move notes under this folder to ungrouped
    const updatedNotes = notes().map(note => 
      note.groupId === id 
        ? { ...note, groupId: undefined, updatedAt: Date.now() }
        : note
    )
    setNotes(updatedNotes)
    saveToStorage(updatedNotes)

    // Remove folder
    const updatedGroups = groups().filter(group => group.id !== id)
    setGroups(updatedGroups)
    saveGroupsToStorage(updatedGroups)

    // Clear selection if the deleted folder was selected
    if (selectedGroupId() === id) {
      setSelectedGroupId(null)
    }
  }

  // Handle resize drag
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing()) {
        const newWidth = Math.max(210, Math.min(600, e.clientX))
        setSidebarWidth(newWidth)
        saveSidebarWidth(newWidth)
      }
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Handle context menu
  const handleContextMenu = (e: MouseEvent, noteId: string) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      noteId
    })
  }

  // Editor context menu
  const handleEditorContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    setEditorContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    })
  }

  let editorEl: HTMLDivElement | null = null
  let lastEditorBoundNoteId: string | null = null

  const ensureSelectionInsideEditor = () => {
    if (!editorEl) return null
    let selection = window.getSelection()
    if (!selection) return null
    if (selection.rangeCount === 0 || !editorEl.contains(selection.anchorNode)) {
      const range = document.createRange()
      range.selectNodeContents(editorEl)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    return selection
  }

  const insertHtmlTable = (rows: number = 3, cols: number = 2) => {
    const note = selectedNote()
    if (!note || !editorEl) return

    const selection = ensureSelectionInsideEditor() || window.getSelection()
    if (!selection) return
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    if (!range) return

    // Build table
    const table = document.createElement('table')
    table.className = 'w-full max-w-full border border-gray-300 border-collapse text-sm my-2'
    const thead = document.createElement('thead')
    const headTr = document.createElement('tr')
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th')
      th.className = 'border border-gray-300 px-2 py-1 text-left bg-gray-50'
      th.textContent = `Header ${c + 1}`
      headTr.appendChild(th)
    }
    thead.appendChild(headTr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr')
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td')
        td.className = 'border border-gray-300 px-2 py-1 align-top'
        td.innerHTML = '&nbsp;'
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    // Insert table and place caret at the first cell
    range.deleteContents()
    range.insertNode(table)

    const firstCell = tbody.querySelector('td') as HTMLTableCellElement | null
    if (firstCell) {
      const newRange = document.createRange()
      newRange.selectNodeContents(firstCell)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }

    // Sync content
    updateNote(note.id, { content: editorEl.innerHTML })
    editorEl.focus()
  }

  // Sync editor content when switching to another note
  createEffect(() => {
    const note = selectedNote()
    if (!editorEl) return
    const currentId = note ? note.id : null
    if (currentId !== lastEditorBoundNoteId) {
      editorEl.innerHTML = note?.content || ''
      lastEditorBoundNoteId = currentId
    }
  })

  // Close menus when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown-container')) {
      setDropdownOpen(false)
    }
    if (!target.closest('.context-menu')) {
      setContextMenu(prev => ({ ...prev, visible: false }))
      setEditorContextMenu(prev => ({ ...prev, visible: false }))
    }
  }

  // Close menus/modals with ESC
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false)
      setContextMenu(prev => ({ ...prev, visible: false }))
      setEditorContextMenu(prev => ({ ...prev, visible: false }))
      setIsMainModalOpen(false)
      setIsSearchModalOpen(false)
    }
  }

  // Load data when component mounts
  onMount(() => {
    const stored = loadFromStorage()
    setNotes(stored)
    // Restore last selected group and note
    const restoredGroup = loadSelectedGroupId()
    setSelectedGroupId(restoredGroup)
    const restoredNote = loadSelectedNoteId()
    if (restoredNote && stored.some(n => n.id === restoredNote)) {
      setSelectedNoteId(restoredNote)
    } else if (stored.length > 0) {
      setSelectedNoteId(stored[0].id)
    }
    selectionRestored = true

    // Load folders
    const storedGroups = loadGroupsFromStorage()
    setGroups(storedGroups)
    
    // Load saved sidebar width
    const savedWidth = loadSidebarWidth()
    setSidebarWidth(savedWidth)
    
    // Load saved sidebar visibility
    const savedVisible = loadSidebarVisible()
    setSidebarVisible(savedVisible)

    // Kick off initial sync and realtime
    void runSyncOnce()
    const unsubscribe = subscribeRealtime()

    // Add click-outside event listener
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    // Apply global spellcheck preference immediately and observe DOM changes
    applySpellcheckToTree(spellcheckDisabled())
    if (spellcheckObserver) spellcheckObserver.disconnect()
    spellcheckObserver = new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) applySpellcheckToTree(spellcheckDisabled(), n)
      }))
    })
    spellcheckObserver.observe(document.body, { childList: true, subtree: true })
    
    // Cleanup event listener
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      if (spellcheckObserver) { spellcheckObserver.disconnect(); spellcheckObserver = null }
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  })

  return (
    <div class="flex h-screen bg-gray-50 overflow-x-hidden w-full">
      {/* Floating bottom-left actions */}
      <div class="fixed left-4 bottom-4 z-40 flex items-center gap-2">
        {/* Account pill */}
        <button
          onClick={() => { setActiveModalTab('account'); setIsMainModalOpen(true) }}
          class="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-gray-200 shadow text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Account"
        >
          <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <div class="i-f7:person w-4 h-4" />
          </div>
          <span class="text-sm">Guest</span>
        </button>

        {/* Settings circle */}
        <button
          onClick={() => { setActiveModalTab('settings'); setIsMainModalOpen(true) }}
          class="w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Settings"
        >
          <div class="i-f7:gear-alt w-5 h-5" />
        </button>
      </div>
      {/* Left sidebar */}
      {sidebarVisible() && (
        <div 
          class="bg-white border-r border-gray-200 flex flex-col relative" 
          style={`width: ${sidebarWidth()}px`}
          onDragOver={(e) => {
            // Allow dragging over other sidebar areas to avoid forbidden cursor
            if (draggedGroupId()) {
              e.preventDefault()
              if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move'
              }
            }
          }}
        >
                {/* Header */}
        <div class="p-4 ">
          <div class="flex items-center justify-between mb-3">
            <h1 class="text-lg font-semibold text-gray-800">Light Notes</h1>
            <div class="flex items-center space-x-1">
              <button
                onClick={toggleSidebar}
                class="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                title="Hide sidebar"
              >
                <div class="i-f7:sidebar-left w-4 h-4" />
              </button>
                             <button
                 onClick={() => createNewNote()}
                 class="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                 title="New note"
               >
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                 </svg>
               </button>
            </div>
          </div>
                     {/* 搜索按鈕 */}
           <button class="flex items-center space-x-2 p-2 w-full text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left cursor-pointer" onClick={() => { setIsSearchModalOpen(true); setTimeout(() => searchInputEl?.focus(), 0) }}>
             <div class="i-f7:search w-4 h-4 text-gray-400 flex-shrink-0" />
             <span class="text-sm text-gray-500">Search</span>
           </button>
        </div>

        {/* 筆記列表頭部 */}
        <div class="px-4 pb-1">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-600">Folders</span>
            <div class="relative dropdown-container">
                         <button
               onClick={() => setDropdownOpen(!dropdownOpen())}
               class="p-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
               title="More options"
             >
               <div class="i-f7:plus w-4 h-4" />
             </button>
            
            {/* Dropdown menu */}
            {dropdownOpen() && (
              <div class="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                 <div class="py-1">
                   <button
                     onClick={() => {
                       setDropdownOpen(false)
                       createNewNote('normal')
                     }}
                     class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                   >
                     <div class="i-f7:doc-text w-3 h-3 inline-block mr-2" />New normal note
                   </button>
                   <button
                     onClick={() => {
                       setDropdownOpen(false)
                       createNewNote('material')
                     }}
                     class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                   >
                     <div class="i-f7:book w-3 h-3 inline-block mr-2" />New material note
                   </button>
                   <button
                     onClick={() => {
                       setDropdownOpen(false)
                       createNewNote('template')
                     }}
                     class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                   >
                     <div class="i-f7:rectangle-stack w-3 h-3 inline-block mr-2" />New template note
                   </button>
                   <div class="border-t border-gray-200 my-1"></div>
                   <button
                     onClick={() => {
                       setDropdownOpen(false)
                       createNewGroup()
                     }}
                     class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                   >
                     <div class="i-f7:folder w-3 h-3 inline-block mr-2" />New folder
                   </button>
                   <button
                     onClick={() => {
                       setDropdownOpen(false)
                       setFiltersVisible(!filtersVisible())
                     }}
                     class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                   >
                     <div class="i-f7:slider-horizontal-3 w-3 h-3 inline-block mr-2" />{filtersVisible() ? 'Hide filters' : 'Show filters'}
                   </button>
                 </div>
              </div>
            )}
          </div>
          </div>
          
                     {/* 篩選按鈕 */}
           {filtersVisible() && (
             <div class="flex flex-wrap gap-1">
               <button
                 onClick={() => setFilterType('all')}
                 class={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                   filterType() === 'all' 
                     ? 'bg-gray-200 text-gray-800' 
                     : 'text-gray-600 hover:bg-gray-100'
                 }`}
               >
                  All ({noteStats().all})
               </button>
               <button
                 onClick={() => setFilterType('favorites')}
                 class={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                   filterType() === 'favorites' 
                     ? 'bg-gray-200 text-gray-800' 
                     : 'text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <div class="i-f7:star-fill w-3 h-3 inline-block mr-1" />Favorites ({noteStats().favorites})
               </button>
               <button
                 onClick={() => setFilterType('normal')}
                 class={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                   filterType() === 'normal' 
                     ? 'bg-gray-200 text-gray-800' 
                     : 'text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <div class="i-f7:doc-text w-3 h-3 inline-block mr-1" />Normal ({noteStats().normal})
               </button>
               <button
                 onClick={() => setFilterType('material')}
                 class={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                   filterType() === 'material' 
                     ? 'bg-gray-200 text-gray-800' 
                     : 'text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <div class="i-f7:book w-3 h-3 inline-block mr-1" />Material ({noteStats().material})
               </button>
               <button
                 onClick={() => setFilterType('template')}
                 class={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                   filterType() === 'template' 
                     ? 'bg-gray-200 text-gray-800' 
                     : 'text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <div class="i-f7:rectangle-stack w-3 h-3 inline-block mr-1" />Template ({noteStats().template})
               </button>
             </div>
           )}
        </div>

        {/* 資料夾列表 */}
        <div 
          class="px-2 pb-2"
          onDragOver={(e) => {
            // 檢查是否在資料夾列表容器範圍內但不在任何資料夾上
            const target = e.target as HTMLElement
            if (!target.closest('[data-folder-item]') && draggedGroupId()) {
              e.preventDefault()
              if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move'
              }
              // 僅在超出所有項目的範圍時才設置最上/最下
              const container = e.currentTarget as HTMLElement
              const items = container.querySelectorAll('[data-folder-item]')
              if (items.length === 0) {
                setInsertIndex(0)
                return
              }
              const firstRect = (items[0] as HTMLElement).getBoundingClientRect()
              const lastRect = (items[items.length - 1] as HTMLElement).getBoundingClientRect()
              if (e.clientY < firstRect.top) {
                setInsertIndex(0)
              } else if (e.clientY > lastRect.bottom) {
                setInsertIndex(items.length)
              } // 介於項目之間時，不改變 insertIndex，交由每個項目的 dragover 設置
            }
          }}
          onDrop={(e) => {
            // 容器 drop 也交由全域 drop 處理
            handleGroupDrop(e as unknown as DragEvent)
          }}
        >
          {/* All notes button removed as per requirement */}
          
          {/* Ungrouped removed from folder area */}
          
          {/* Folder list */}
          <For each={groups()}>
            {(group, index) => (
              <div
                data-folder-item
                draggable={editingGroupId() !== group.id}
                onDragStart={(e) => handleGroupDragStart(e as unknown as DragEvent, group.id)}
                onDragOver={(e) => handleGroupDragOver(e as unknown as DragEvent, group.id)}
                onDragLeave={handleGroupDragLeave}
                onDrop={(e) => handleGroupDrop(e as unknown as DragEvent)}
                onDragEnd={handleGroupDragEnd}
                onClick={(e) => {
                  // 如果點擊的是輸入框，不要觸發選擇
                  if ((e.target as HTMLElement).tagName === 'INPUT') return
                  
                  if (editingGroupId() === group.id) {
                    // 如果正在編輯，完成編輯
                    const input = document.querySelector(`input[data-group-id="${group.id}"]`) as HTMLInputElement
                    if (input) {
                      updateGroup(group.id, input.value)
                    }
                  } else {
                    selectGroup(group.id)
                    selectNote(null)
                  }
                }}
                class={`group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors relative ${
                  selectedGroupId() === group.id ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
                } ${draggedGroupId() === group.id ? 'opacity-50' : ''}`}
              >
                {/* 插入線：如果 insertIndex 等於當前 index，畫在頂部 */}
                {insertIndex() === index() && (
                  <div
                    ref={(el) => {
                      el.style.opacity = '0'
                      requestAnimationFrame(() => {
                        el.style.transition = 'opacity 240ms ease-out'
                        el.style.opacity = '1'
                      })
                    }}
                    class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
                    style="top:-2px; left:-0.25rem; right:-0.25rem; transform: translateX(4px);"
                  />
                )}
                
                <div class="i-f7:folder-fill w-4 h-4 text-gray-400 flex-shrink-0" />
                
                {editingGroupId() === group.id ? (
                  <input
                    type="text"
                    value={group.name}
                    data-group-id={group.id}
                    spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
                    onBlur={(e) => updateGroup(group.id, (e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateGroup(group.id, (e.target as HTMLInputElement).value)
                      } else if (e.key === 'Escape') {
                        setEditingGroupId(null)
                      }
                    }}
                    class="text-sm flex-1 bg-transparent border border-gray-300 rounded px-1 outline-none focus:border-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    class="text-sm flex-1 truncate"
                    onDblClick={(e) => {
                      e.stopPropagation()
                      setEditingGroupId(group.id)
                      setTimeout(() => {
                        const input = document.querySelector(`input[data-group-id="${group.id}"]`) as HTMLInputElement
                        if (input) {
                          input.focus()
                          input.select()
                        }
                      }, 10)
                    }}
                  >
                    {group.name}
                  </span>
                )}
                
                <span class="text-xs text-gray-500">({notes().filter(note => note.groupId === group.id).length})</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteGroup(group.id)
                  }}
                  class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer"
                >
                  <div class="i-f7:trash w-3 h-3" />
                </button>
                
                {/* 插入線：如果 insertIndex 在最後，畫在最後一項底部 */}
                {insertIndex() === groups().length && index() === groups().length - 1 && (
                  <div
                    ref={(el) => {
                      el.style.opacity = '0'
                      requestAnimationFrame(() => {
                        el.style.transition = 'opacity 240ms ease-out'
                        el.style.opacity = '1'
                      })
                    }}
                    class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
                    style="bottom:-2px; left:-0.25rem; right:0.215rem; transform: translateX(4px);"
                  />
                )}
              </div>
            )}
          </For>
          
          {/* Insert line when folder list is empty: use absolute positioning to not affect layout */}
          {groups().length === 0 && insertIndex() !== null && (
            <div class="relative" style="height:0;">
              <div
                ref={(el) => {
                  el.style.opacity = '0'
                  requestAnimationFrame(() => {
                    el.style.transition = 'opacity 240ms ease-out'
                    el.style.opacity = '1'
                  })
                }}
                class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
                style="top:-2px; left:-0.25rem; right:-0.25rem; transform: translateX(4px);"
              />
            </div>
          )}
        </div>

        {/* Notes list - always shown */}
        <div class="flex-1 overflow-y-auto px-2 pt-1 pb-2 border-t border-gray-100">
          <div class="px-2 py-2 text-xs font-medium text-gray-600 flex items-center gap-2 relative">
            <span>{leftListFilter() === 'all' ? 'All Notes' : 'Ungrouped only'}</span>
            <button class="p-1 rounded hover:bg-gray-100 cursor-pointer text-gray-600" title="Filter" onClick={() => setLeftListDropdownOpen(!leftListDropdownOpen())}>
              <div class="i-f7:chevron-down w-3 h-3" />
            </button>
            <button class="p-1 rounded hover:bg-gray-100 cursor-pointer text-gray-600 ml-auto" title="Sort" onClick={() => setLeftListSortOpen(!leftListSortOpen())}>
              <div class="i-f7:line-horizontal-3-decrease w-3.5 h-3.5" />
            </button>
            {leftListDropdownOpen() && (
              <div class="absolute left-2 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow z-20">
                <button class={`w-full px-3 py-2 text-xs flex items-center ${leftListFilter()==='all' ? 'bg-gray-100 text-gray-800':'text-gray-700 hover:bg-gray-50'} cursor-pointer`} onClick={() => { setLeftListFilter('all'); setLeftListDropdownOpen(false) }}>
                  <span>All notes</span>
                  <span class="ml-auto text-gray-500">({notes().length})</span>
                </button>
                <button class={`w-full px-3 py-2 text-xs flex items-center ${leftListFilter()==='ungrouped' ? 'bg-gray-100 text-gray-800':'text-gray-700 hover:bg-gray-50'} cursor-pointer`} onClick={() => { setLeftListFilter('ungrouped'); setLeftListDropdownOpen(false) }}>
                  <span>Ungrouped only</span>
                  <span class="ml-auto text-gray-500">({notes().filter(n => !n.groupId).length})</span>
                </button>
              </div>
            )}
            {leftListSortOpen() && (
              <div class="absolute right-2 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow z-20 p-2 text-xs text-gray-700 space-y-2">
                <div class="font-medium text-gray-600 mb-1">Sort</div>
                <div class="flex items-center justify-between">
                  <span>Sort by</span>
                  <select class="px-2 py-1 rounded bg-gray-100" value={leftListSortKey()} onChange={(e) => setLeftListSortKey((e.target as HTMLSelectElement).value as any)}>
                    <option value="updated">Updated time</option>
                    <option value="created">Created time</option>
                    <option value="title">Title</option>
                  </select>
                </div>
                <div class="flex items-center justify-between">
                  <span>Order</span>
                  <select class="px-2 py-1 rounded bg-gray-100" value={leftListSortOrder()} onChange={(e) => setLeftListSortOrder((e.target as HTMLSelectElement).value as any)}>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
                <div class="flex items-center justify-between">
                  <span>Pinned first</span>
                  <button class={`px-2 py-1 rounded ${leftListPinnedFirst() ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} cursor-pointer`} onClick={() => setLeftListPinnedFirst(!leftListPinnedFirst())}>{leftListPinnedFirst() ? 'On' : 'Off'}</button>
                </div>
              </div>
            )}
          </div>
            <For each={sortNotesByPinAndUpdated(leftListFilter()==='all' ? notes() : notes().filter(n => !n.groupId))}>
              {(note) => (
                <div
                  onClick={() => {
                    selectNote(note.id)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, note.id)}
                  class={`group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors ${
                    selectedNoteId() === note.id ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <div class="i-f7:doc-text w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-1">
                      <h3 class="font-medium truncate text-sm flex-1">
                        {note.title || 'Untitled'}
                      </h3>
                      {note.pinned && <div class="i-f7:pin-fill w-3 h-3 text-gray-700" />}
                      {note.isFavorite && <div class="i-f7:star-fill w-3 h-3 text-yellow-500" />}
                      {note.type === 'material' && <div class="i-f7:book w-3 h-3 text-gray-600" />}
                      {note.type === 'template' && <div class="i-f7:rectangle-stack w-3 h-3 text-green-500" />}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer"
                  >
                    <div class="i-f7:trash w-3 h-3" />
                  </button>
                </div>
              )}
            </For>
            {(leftListFilter()==='all' ? notes().length === 0 : notes().filter(n => !n.groupId).length === 0) && (
              <div class="p-6 text-center text-gray-500">
                <div class="text-xs">
                  {leftListFilter()==='all' ? (searchQuery() ? 'No matching notes found' : 'No notes yet, click the button above to start writing') : 'No ungrouped notes'}
                </div>
              </div>
            )}
          </div>
        
        {/* Handle drag resize control bar */}
        <div 
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-gray-200 transition-colors"
          onMouseDown={handleMouseDown}
        />
        </div>
      )}

      {/* Middle content panel - visible when a folder is selected */}
      {selectedGroupId() !== undefined && (
        <div class="bg-white border-r border-gray-200 flex flex-col" style={`width: ${contentPanelWidth()}px; max-width: calc(100vw - ${sidebarWidth()}px);`}>
          {/* Content panel header */}
          <div class="p-4 border-b border-gray-200">
            <div class="flex items-center space-x-2">
              {!sidebarVisible() && (
                <button
                  onClick={toggleSidebar}
                  class="p-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer flex-shrink-0"
                  title="Show sidebar"
                >
                  <div class="i-f7:sidebar-left w-4 h-4" />
                </button>
              )}
              {selectedGroupId() === null ? (
                <h2 class="text-lg font-semibold text-gray-800 flex-1">Ungrouped</h2>
              ) : (
                (() => {
                  const group = groups().find(g => g.id === selectedGroupId())
                  return group ? (
                    <input
                      type="text"
                      value={isFolderPanelEditing() ? folderPanelEditingTitle() : group.name}
                      onInput={(e) => setFolderPanelEditingTitle((e.target as HTMLInputElement).value)}
                      onFocus={() => {
                        setIsFolderPanelEditing(true)
                        setFolderPanelEditingTitle(group.name)
                      }}
                      onBlur={(e) => {
                        const newTitle = (e.target as HTMLInputElement).value.trim()
                        if (newTitle && newTitle !== group.name) {
                          updateGroupRealtime(group.id, newTitle)
                        } else if (!newTitle) {
                          // Keep original name if user clears the input
                          setFolderPanelEditingTitle(group.name)
                        }
                        setIsFolderPanelEditing(false)
                        setFolderPanelEditingTitle('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newTitle = (e.target as HTMLInputElement).value.trim()
                          if (newTitle && newTitle !== group.name) {
                            updateGroupRealtime(group.id, newTitle)
                          }
                          setIsFolderPanelEditing(false)
                          setFolderPanelEditingTitle('')
                          ;(e.target as HTMLInputElement).blur()
                        } else if (e.key === 'Escape') {
                          setIsFolderPanelEditing(false)
                          setFolderPanelEditingTitle('')
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      class="text-lg font-semibold bg-transparent border-none outline-none flex-1"
                      placeholder="Folder name..."
                    />
                  ) : (
                    <h2 class="text-lg font-semibold text-gray-800 flex-1">Content</h2>
                  )
                })()
              )}
              <span class="text-sm text-gray-500 flex-shrink-0">
                {filteredNotes().length} notes
              </span>
            </div>
          </div>

          {/* Content list */}
          <div class="flex-1 overflow-y-auto px-2 pt-2 pb-2">
            <For each={filteredNotes()}>
              {(note) => (
                <div
                  onClick={() => {
                    selectNote(note.id)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, note.id)}
                  class={`group flex items-center space-x-2 p-3 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors ${
                    selectedNoteId() === note.id ? 'bg-gray-200 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-1 mb-1">
                      <h3 class="font-medium truncate text-sm flex-1">
                        {note.title || 'Untitled'}
                      </h3>
                      {note.isFavorite && <div class="i-f7:star-fill w-3 h-3 text-yellow-500" />}
                      {note.type === 'material' && <div class="i-f7:book w-3 h-3 text-gray-600" />}
                      {note.type === 'template' && <div class="i-f7:rectangle-stack w-3 h-3 text-green-500" />}
                    </div>
                    <p class="text-xs text-gray-500 truncate">
                      {(() => {
                        const text = htmlToPlainText(note.content || '')
                        return text ? (text.length > 60 ? text.substring(0, 60) + '...' : text) : 'Empty note'
                      })()}
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                      {new Date(note.updatedAt).toLocaleDateString('en-US')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer"
                  >
                    <div class="i-f7:trash w-3 h-3" />
                  </button>
                </div>
              )}
            </For>
            {filteredNotes().length === 0 && (
              <div class="p-6 text-center text-gray-500">
                <div class="text-xs">
                  {selectedGroupId() === null ? 'No notes in Ungrouped' : 'No notes in this folder'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right editor area */}
      <div class="flex-1 flex flex-col min-w-0">
        {selectedNote() ? (
          <>
            {/* Editor header */}
            <div class="p-4 border-b border-gray-200 bg-white">
              <div class="flex items-center space-x-2">
                <input
                  type="text"
                  value={selectedNote()!.title}
                  onInput={(e) => updateNote(selectedNote()!.id, { title: e.target.value })}
                  spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
                  class="text-xl font-semibold bg-transparent border-none outline-none flex-1"
                  placeholder="Note title..."
                />
              </div>
            </div>

            {/* Editor content (contenteditable) */}
            <div class="flex-1 p-4 bg-white overflow-x-auto overflow-y-auto editor-content" onContextMenu={(e) => handleEditorContextMenu(e as unknown as MouseEvent)}>
              <div
                contentEditable
                onInput={(e) => {
                  const html = (e.currentTarget as HTMLElement).innerHTML
                  updateNote(selectedNote()!.id, { content: html })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const selection = ensureSelectionInsideEditor() || window.getSelection()
                    if (!selection) return
                    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
                    if (!range) return
                    const spaces = document.createTextNode('    ')
                    range.insertNode(spaces)
                    range.setStartAfter(spaces)
                    range.setEndAfter(spaces)
                    selection.removeAllRanges()
                    selection.addRange(range)
                    if (editorEl) {
                      updateNote(selectedNote()!.id, { content: editorEl.innerHTML })
                    }
                  }
                }}
                ref={(el) => {
                  editorEl = el as HTMLDivElement
                  // Initial content sync
                  editorEl.innerHTML = selectedNote()!.content || ''
                }}
                class="min-w-max h-full border-none outline-none text-gray-700 leading-relaxed font-mono"
                spellcheck="false" autocapitalize="off" autocorrect="off"
                lang="en-US"
                style="white-space: pre-wrap;"
              />
            </div>
          </>
        ) : (
          <div class="flex-1 flex items-center justify-center bg-white">
            <div class="text-center text-gray-500">
              <div class="i-f7:doc-text w-16 h-16 mb-4 mx-auto text-gray-400" />
              <h2 class="text-xl font-medium mb-2">Select a note to start editing</h2>
              <p class="text-gray-400">Or create a new note</p>
            </div>
          </div>
        )}
      </div>

      {/* Context menu for notes list/content */}
      {contextMenu().visible && (() => {
        const menu = contextMenu()
        const note = notes().find(n => n.id === menu.noteId)
        if (!note) return null
        
        const properties = getNoteProperties(note)
        
        return (
          <div 
            class="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 min-w-48"
            style={`left: ${menu.x}px; top: ${menu.y}px;`}
          >
            {/* Small arrow */}
            <div class="absolute -top-2 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white"></div>
            <div class="absolute -top-3 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-200"></div>
            
            <div class="text-xs text-gray-600">
              {/* Actions */}
              <div class="space-y-1 mb-3">
                <button
                  onClick={() => {
                    toggleFavorite(note.id)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                  class="w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer flex items-center space-x-2"
                >
                   <div class={`w-3 h-3 ${note.isFavorite ? 'i-f7:star-fill' : 'i-f7:star'}`} />
                  <span>{note.isFavorite ? 'Remove Favorite' : 'Add Favorite'}</span>
                </button>
                <button
                  onClick={() => {
                    const updated = notes().map(n => n.id === note.id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n)
                    setNotes(updated)
                    saveToStorage(updated)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                  class="w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer flex items-center space-x-2"
                >
                  <div class={`w-3 h-3 ${note.pinned ? 'i-f7:pin-fill' : 'i-f7:pin'}`} />
                  <span>{note.pinned ? 'Unpin note' : 'Pin note'}</span>
                </button>
                
                <div class="border-t border-gray-100 pt-1">
                  <div class="text-gray-500 mb-1">Change type:</div>
                  <button
                    onClick={() => {
                      changeNoteType(note.id, 'normal')
                      setContextMenu(prev => ({ ...prev, visible: false }))
                    }}
                                         class={`w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer ${note.type === 'normal' ? 'bg-gray-100 text-gray-800' : ''}`}
                  >
                    <div class="i-f7:doc-text w-3 h-3 inline-block mr-2" />Normal note
                  </button>
                  <button
                    onClick={() => {
                      changeNoteType(note.id, 'material')
                      setContextMenu(prev => ({ ...prev, visible: false }))
                    }}
                                         class={`w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer ${note.type === 'material' ? 'bg-gray-100 text-gray-800' : ''}`}
                  >
                    <div class="i-f7:book w-3 h-3 inline-block mr-2" />Material note
                  </button>
                  <button
                    onClick={() => {
                      changeNoteType(note.id, 'template')
                      setContextMenu(prev => ({ ...prev, visible: false }))
                    }}
                                         class={`w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer ${note.type === 'template' ? 'bg-gray-100 text-gray-800' : ''}`}
                  >
                    <div class="i-f7:rectangle-stack w-3 h-3 inline-block mr-2" />Template note
                  </button>
                </div>
              </div>
              
              {/* Properties */}
              <div class="border-t border-gray-100 pt-2 space-y-1">
                <div class="font-medium text-gray-800 mb-2">Note Properties</div>
                <div class="flex justify-between">
                  <span>Characters:</span>
                  <span class="font-mono">{properties.characters.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span>Sentences:</span>
                  <span class="font-mono">{properties.sentences.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span>Paragraphs:</span>
                  <span class="font-mono">{properties.paragraphs.toLocaleString()}</span>
                </div>
                <div class="border-t border-gray-100 pt-1 mt-2">
                  <div class="text-gray-500">Created at:</div>
                  <div class="font-mono text-xs">{properties.createdAt}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Editor context menu */}
      {editorContextMenu().visible && (
        <div
          class="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 min-w-36"
          style={`left: ${editorContextMenu().x}px; top: ${editorContextMenu().y}px;`}
        >
          <button
            onClick={() => {
              insertHtmlTable(3, 2)
              setEditorContextMenu(prev => ({ ...prev, visible: false }))
            }}
            class="w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-xs text-gray-700 flex items-center space-x-2"
          >
            <div class="i-f7:table w-3 h-3" />
            <span>New Table</span>
          </button>
        </div>
      )}

      {/* Shared Main Modal with left sidemenu */}
      {isMainModalOpen() && (
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div
            class="absolute inset-0 bg-black/30"
            onClick={() => setIsMainModalOpen(false)}
          />
          <div class="relative bg-white rounded-lg shadow-xl border border-gray-200 w-[720px] max-w-[95vw] h-[560px] max-h-[90%] overflow-hidden p-0">
            <div class="flex h-full">
              {/* Side menu */}
              <div class="w-48 border-r border-gray-200 p-3 overflow-y-auto">
                <div class="text-xs text-gray-500 mb-2 px-2">Menu</div>
                <button
                  class={`w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2 ${activeModalTab() === 'account' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setActiveModalTab('account')}
                >
                  <div class="i-f7:person w-4 h-4" />
                  <span class="text-sm">Account</span>
                </button>
                <button
                  class={`w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2 mt-1 ${activeModalTab() === 'settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setActiveModalTab('settings')}
                >
                  <div class="i-f7:gear-alt w-4 h-4" />
                  <span class="text-sm">Settings</span>
                </button>
              </div>

              {/* Content area */}
              <div class="flex-1 p-4 overflow-y-auto">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-semibold text-gray-800">
                    {activeModalTab() === 'account' ? 'Account' : 'Settings'}
                  </h3>
                  <button
                    class="p-1 rounded hover:bg-gray-100 cursor-pointer"
                    onClick={() => setIsMainModalOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    <div class="i-f7:xmark w-5 h-5" />
                  </button>
                </div>

                {activeModalTab() === 'account' ? (
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      <div class="i-f7:person w-6 h-6" />
                    </div>
                    <div>
                      <div class="text-sm text-gray-700">Guest</div>
                      <div class="text-xs text-gray-500">Not signed in</div>
                    </div>
                    <div class="ml-auto">
                      <button class="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 cursor-pointer">Sign in</button>
                    </div>
                  </div>
                ) : (
                  <div class="space-y-3 text-sm text-gray-700">
                    <div class="flex items-center justify-between">
                      <span>Sidebar visible</span>
                      <button
                        class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer"
                        onClick={() => {
                          toggleSidebar()
                          setIsMainModalOpen(false)
                        }}
                      >
                        {sidebarVisible() ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Disable browser spellcheck</span>
                      <button
                        class={`px-2 py-1 rounded cursor-pointer ${spellcheckDisabled() ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                        onClick={() => {
                          const next = !spellcheckDisabled()
                          setSpellcheckDisabled(next)
                          saveSpellcheckDisabled(next)
                          applySpellcheckToTree(next)
                        }}
                      >
                        {spellcheckDisabled() ? 'On' : 'Off'}
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Language</span>
                      <div class="flex items-center gap-2">
                        <select class="px-2 py-1 rounded bg-gray-100 text-gray-500 cursor-not-allowed" disabled>
                          <option>System</option>
                          <option>English</option>
                          <option>繁體中文</option>
                        </select>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Theme</span>
                      <div class="flex items-center gap-2">
                        <select class="px-2 py-1 rounded bg-gray-100 text-gray-500 cursor-not-allowed" disabled>
                          <option>System</option>
                          <option>Light</option>
                          <option>Dark</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {isSearchModalOpen() && (
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/30" onClick={() => setIsSearchModalOpen(false)} />
          <div class="relative bg-white rounded-lg shadow-xl border border-gray-200 w-[720px] max-w-[95vw] h-[560px] max-h-[90%] overflow-hidden p-0">
            <div class="flex flex-col h-full">
              <div class="p-3 border-b border-gray-200 flex items-center gap-2">
                <div class="i-f7:search w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  ref={(el) => { searchInputEl = el as HTMLInputElement }}
                  value={searchModalQuery()}
                  onInput={(e) => setSearchModalQuery((e.target as HTMLInputElement).value)}
                  spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
                  placeholder="Search notes..."
                  class="flex-1 bg-transparent outline-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const first = searchModalResults()[0]
                      if (first) {
                        selectNote(first.id)
                        setIsSearchModalOpen(false)
                      }
                    }
                  }}
                />
                <button class="p-1 rounded hover:bg-gray-100 cursor-pointer" onClick={() => setIsSearchModalOpen(false)} title="Close" aria-label="Close">
                  <div class="i-f7:xmark w-5 h-5" />
                </button>
              </div>
              <div class="flex-1 overflow-y-auto p-2">
                {searchModalQuery().trim() === '' ? (
                  <div class="text-center text-gray-400 text-sm mt-10">Type to search notes</div>
                ) : (
                  <For each={searchModalResults()}>
                    {(note) => (
                      <div
                        class="p-2 rounded hover:bg-gray-50 cursor-pointer border-b border-gray-50"
                        onClick={() => { selectNote(note.id); setIsSearchModalOpen(false) }}
                      >
                        <div class="text-sm font-medium text-gray-800 truncate">{note.title || 'Untitled'}</div>
                        <div class="text-xs text-gray-500 truncate">
                          {(() => {
                            const text = htmlToPlainText(note.content || '')
                            return text ? (text.length > 100 ? text.substring(0, 100) + '...' : text) : 'Empty note'
                          })()}
                        </div>
                      </div>
                    )}
                  </For>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
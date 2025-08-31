import { createSignal, createMemo, onMount, createEffect, batch } from 'solid-js';
import type { Note, NoteType, Group } from '../types';
import {
  loadFromStorage, saveToStorage,
  loadGroupsFromStorage, saveGroupsToStorage,
  loadSelectedNoteId, saveSelectedNoteId,
  loadSelectedGroupId, saveSelectedGroupId,
  loadSidebarWidth, saveSidebarWidth,
  loadSidebarVisible, saveSidebarVisible,
  loadSpellcheckDisabled,
} from '../services/storage.ts';
import { htmlToPlainText } from '../lib/editor.ts';

export function createNotesStore() {
  // --- STATE (Signals) ---
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [groups, setGroups] = createSignal<Group[]>([]);
  const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = createSignal(320);
  const [isResizing, setIsResizing] = createSignal(false);
  const [sidebarVisible, setSidebarVisible] = createSignal(true);
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{visible: boolean, x: number, y: number, noteId: string | null}>({ visible: false, x: 0, y: 0, noteId: null });
  const [editorContextMenu, setEditorContextMenu] = createSignal<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 });
  const [filterType, setFilterType] = createSignal<'all' | NoteType | 'favorites'>('all');
  const [filtersVisible, setFiltersVisible] = createSignal(false);
  const [editingGroupId, setEditingGroupId] = createSignal<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = createSignal<string | null>(null);
  const [insertIndex, setInsertIndex] = createSignal<number | null>(null);
  const [isMainModalOpen, setIsMainModalOpen] = createSignal(false);
  const [activeModalTab, setActiveModalTab] = createSignal<'account' | 'settings'>('account');
  const [isSearchModalOpen, setIsSearchModalOpen] = createSignal(false);
  const [searchModalQuery, setSearchModalQuery] = createSignal('');
  
  // Sidebar List State
  const [leftListFilter, setLeftListFilter] = createSignal<'all' | 'ungrouped'>('all');
  const [leftListDropdownOpen, setLeftListDropdownOpen] = createSignal(false);
  const [leftListSortOpen, setLeftListSortOpen] = createSignal(false);
  const [leftListSortKey, setLeftListSortKey] = createSignal<'updated' | 'created' | 'title'>('updated');
  const [leftListSortOrder, setLeftListSortOrder] = createSignal<'asc' | 'desc'>('desc');
  const [leftListPinnedFirst, setLeftListPinnedFirst] = createSignal(true);
  const [leftSortDropdownPos, setLeftSortDropdownPos] = createSignal<{ left: number, top: number }>({ left: 0, top: 0 });

  const [spellcheckDisabled, setSpellcheckDisabled] = createSignal<boolean>(loadSpellcheckDisabled());
  let selectionRestored = false;

  // --- DERIVED STATE (Memos) ---
  const selectedNote = createMemo(() => {
    const id = selectedNoteId();
    return id ? notes().find(note => note.id === id) : null;
  });

  const noteStats = createMemo(() => {
    const allNotes = notes();
    return {
      all: allNotes.length,
      favorites: allNotes.filter(note => note.isFavorite).length,
      normal: allNotes.filter(note => note.type === 'normal').length,
      material: allNotes.filter(note => note.type === 'material').length,
      template: allNotes.filter(note => note.type === 'template').length
    };
  });

  const sortedNotes = createMemo(() => {
    const base = leftListFilter() === 'all' ? notes() : notes().filter(n => !n.groupId);
    return [...base].sort((a, b) => {
      if (leftListPinnedFirst()) {
        const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDelta !== 0) return pinDelta;
      }
      const key = leftListSortKey();
      const dir = leftListSortOrder() === 'asc' ? 1 : -1;
      let delta = 0;
      if (key === 'updated') delta = (a.updatedAt - b.updatedAt) * dir;
      else if (key === 'created') delta = (a.createdAt - b.createdAt) * dir;
      else {
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        delta = at.localeCompare(bt) * dir;
      }
      if (delta !== 0) return delta;
      // Tie-breaker: updated desc
      return b.updatedAt - a.updatedAt;
    });
  });

  const searchModalResults = createMemo(() => {
    const q = searchModalQuery().trim().toLowerCase();
    if (!q) return [] as Note[];
    return notes().filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      htmlToPlainText(n.content || '').toLowerCase().includes(q)
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  });
  
  // --- ACTIONS (Functions) ---

  const selectNote = (id: string | null) => {
    setSelectedNoteId(id);
    saveSelectedNoteId(id);
  };

  const selectGroup = (gid: string | null | undefined) => {
    setSelectedGroupId(gid);
    saveSelectedGroupId(gid);
  };
  
  const toggleSidebar = () => {
    const newVisible = !sidebarVisible();
    setSidebarVisible(newVisible);
    saveSidebarVisible(newVisible);
  };

  const createNewNote = (type: NoteType = 'normal') => {
    const newNote: Note = {
      id: `${Date.now()}`,
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type,
      isFavorite: false,
      pinned: false,
      groupId: selectedGroupId() ?? undefined,
    };
    
    batch(() => {
        setNotes([newNote, ...notes()]);
        selectNote(newNote.id);
    });

    saveToStorage([newNote, ...notes()]);
    // ... (database logic for Dexie)
  };
  
  const updateNote = (id: string, updates: Partial<Note>) => {
    const updatedNotes = notes().map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: Date.now() }
        : note
    );
    setNotes(updatedNotes);
    saveToStorage(updatedNotes);
    // ... (database logic for Dexie)
  };

  const deleteNote = (id: string) => {
    const updatedNotes = notes().filter(note => note.id !== id);
    setNotes(updatedNotes);
    if (selectedNoteId() === id) {
      selectNote(null);
    }
    saveToStorage(updatedNotes);
    // ... (database logic for Dexie)
  };

  const createNewGroup = (name: string = 'New Folder') => {
    const newGroup: Group = {
      id: `${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedGroups = [newGroup, ...groups()];
    setGroups(updatedGroups);
    saveGroupsToStorage(updatedGroups);
    setEditingGroupId(newGroup.id);
  };
  
  const updateGroup = (id: string, name: string) => {
    const updated = groups().map(group => 
      group.id === id 
        ? { ...group, name: name.trim() || 'New Folder', updatedAt: Date.now() }
        : group
    );
    setGroups(updated);
    saveGroupsToStorage(updated);
    setEditingGroupId(null);
  };
  
  const deleteGroup = (id: string) => {
    batch(() => {
      const updatedNotes = notes().map(note => 
        note.groupId === id 
          ? { ...note, groupId: undefined, updatedAt: Date.now() }
          : note
      );
      setNotes(updatedNotes);
      saveToStorage(updatedNotes);

      const updatedGroups = groups().filter(group => group.id !== id);
      setGroups(updatedGroups);
      saveGroupsToStorage(updatedGroups);

      if (selectedGroupId() === id) {
        selectGroup(null);
      }
    });
  };

  // Drag and Drop Handlers
  const handleGroupDragStart = (e: DragEvent, groupId: string) => {
    setDraggedGroupId(groupId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', groupId);
    }
  };
  const handleGroupDragOver = (e: DragEvent, groupId: string) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const elementHeight = rect.height;
    const currentIndex = groups().findIndex(g => g.id === groupId);
    if (currentIndex === -1) return;
    const nextInsertIndex = relativeY < elementHeight / 2 ? currentIndex : currentIndex + 1;
    setInsertIndex(nextInsertIndex);
  };
  const handleGroupDragLeave = () => {
    // keep highlight a bit for better UX; no-op
  };
  const handleGroupDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggedGroupId();
    const targetIndex = insertIndex();
    if (!draggedId || targetIndex === null) {
      setDraggedGroupId(null);
      setInsertIndex(null);
      return;
    }
    const current = groups();
    const fromIndex = current.findIndex(g => g.id === draggedId);
    if (fromIndex === -1) {
      setDraggedGroupId(null);
      setInsertIndex(null);
      return;
    }
    let toIndex = targetIndex;
    if (fromIndex < targetIndex) toIndex = targetIndex - 1;
    const newGroups = [...current];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    setGroups(newGroups);
    saveGroupsToStorage(newGroups);
    setDraggedGroupId(null);
    setInsertIndex(null);
  };
  const handleGroupDragEnd = () => {
    setDraggedGroupId(null);
    setInsertIndex(null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const handleMouseMove = (ev: MouseEvent) => {
      if (isResizing()) {
        const newWidth = Math.max(210, Math.min(600, ev.clientX));
        setSidebarWidth(newWidth);
        saveSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleContextMenu = (e: MouseEvent, noteId: string) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId });
  };
  
  const updateLeftSortDropdownPosition = (btnEl: HTMLButtonElement, headerEl: HTMLDivElement) => {
    if (!btnEl) return;
    const buttonRect = btnEl.getBoundingClientRect();
    const menuWidth = 224; // w-56
    const viewportPadding = 8;
    const verticalGap = 4;
    const containerRect = (headerEl || btnEl).getBoundingClientRect();
    let left = sidebarWidth() < 260 ? (containerRect.left + viewportPadding) : (buttonRect.right - menuWidth);
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding));
    const top = buttonRect.bottom + verticalGap;
    setLeftSortDropdownPos({ left, top });
  };

  // --- EFFECTS ---
  onMount(() => {
    setNotes(loadFromStorage());
    setGroups(loadGroupsFromStorage());
    setSidebarWidth(loadSidebarWidth());
    setSidebarVisible(loadSidebarVisible());

    const restoredGroup = loadSelectedGroupId();
    setSelectedGroupId(restoredGroup);
    const restoredNote = loadSelectedNoteId();
    if (restoredNote && notes().some(n => n.id === restoredNote)) {
      setSelectedNoteId(restoredNote);
    } else if (notes().length > 0) {
      setSelectedNoteId(notes()[0].id);
    }
    selectionRestored = true;
    
    // ... (sync logic) ...
  });

  createEffect(() => {
    if (selectionRestored) saveSelectedNoteId(selectedNoteId());
  });
  createEffect(() => {
    if (selectionRestored) saveSelectedGroupId(selectedGroupId());
  });

  // --- RETURN PUBLIC API ---
  return {
    // State (Accessors)
    notes,
    groups,
    selectedNoteId,
    selectedGroupId,
    sidebarWidth,
    isResizing,
    sidebarVisible,
    dropdownOpen,
    contextMenu,
    editorContextMenu,
    filterType,
    filtersVisible,
    editingGroupId,
    draggedGroupId,
    insertIndex,
    isMainModalOpen,
    activeModalTab,
    isSearchModalOpen,
    searchModalQuery,
    searchQuery: searchModalQuery,
    leftListFilter,
    leftListDropdownOpen,
    leftListSortOpen,
    leftListSortKey,
    leftListSortOrder,
    leftListPinnedFirst,
    leftSortDropdownPos,
    spellcheckDisabled,

    // Setters
    setNotes,
    setGroups,
    setSelectedNoteId,
    setSelectedGroupId,
    setSidebarWidth,
    setIsResizing,
    setSidebarVisible,
    setDropdownOpen,
    setContextMenu,
    setEditorContextMenu,
    setFilterType,
    setFiltersVisible,
    setEditingGroupId,
    setDraggedGroupId,
    setInsertIndex,
    setIsMainModalOpen,
    setActiveModalTab,
    setIsSearchModalOpen,
    setSearchModalQuery,
    setLeftListFilter,
    setLeftListDropdownOpen,
    setLeftListSortOpen,
    setLeftListSortKey,
    setLeftListSortOrder,
    setLeftListPinnedFirst,
    setLeftSortDropdownPos,
    setSpellcheckDisabled,

    // Derived State (Memos)
    selectedNote,
    noteStats,
    sortedNotes,
    searchModalResults,

    // Actions (Functions)
    toggleSidebar,
    selectNote,
    selectGroup,
    createNewNote,
    updateNote,
    deleteNote,
    createNewGroup,
    updateGroup,
    deleteGroup,
    handleGroupDragStart,
    handleGroupDragOver,
    handleGroupDragLeave,
    handleGroupDrop,
    handleGroupDragEnd,
    handleMouseDown,
    handleContextMenu,
    updateLeftSortDropdownPosition,
  };
}
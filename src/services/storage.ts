import type { Note, Group } from '../types';

// Notes
export const saveToStorage = (notes: Note[]) => {
  try {
    localStorage.setItem('notes', JSON.stringify(notes));
  } catch {}
};

export const loadFromStorage = (): Note[] => {
  try {
    const stored = localStorage.getItem('notes');
    if (!stored) return [];
    const raw = JSON.parse(stored);
    return (raw as any[]).map((note: any) => ({
      id: String(note.id),
      title: note.title ?? 'New Note',
      content: note.content ?? '',
      createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
      updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
      type: note.type ?? 'normal',
      isFavorite: !!note.isFavorite,
      pinned: !!note.pinned,
      groupId: note.groupId ?? undefined,
    }));
  } catch {
    return [];
  }
};

// Groups
export const saveGroupsToStorage = (groups: Group[]) => {
  try {
    localStorage.setItem('groups', JSON.stringify(groups));
  } catch {}
};

export const loadGroupsFromStorage = (): Group[] => {
  try {
    const stored = localStorage.getItem('groups');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Selected Note
export const saveSelectedNoteId = (id: string | null) => {
  try {
    if (id) localStorage.setItem('selectedNoteId', id);
    else localStorage.removeItem('selectedNoteId');
  } catch {}
};

export const loadSelectedNoteId = (): string | null => {
  try {
    return localStorage.getItem('selectedNoteId') || null;
  } catch {
    return null;
  }
};

// Selected Group
export const saveSelectedGroupId = (gid: string | null | undefined) => {
  try {
    const v = gid === undefined ? '__UNDEF__' : gid === null ? '__NULL__' : gid;
    localStorage.setItem('selectedGroupId', v as string);
  } catch {}
};

export const loadSelectedGroupId = (): string | null | undefined => {
  try {
    const raw = localStorage.getItem('selectedGroupId');
    if (!raw) return undefined;
    if (raw === '__UNDEF__') return undefined;
    if (raw === '__NULL__') return null;
    return raw;
  } catch {
    return undefined;
  }
};

// Sidebar width
export const saveSidebarWidth = (width: number) => {
  try {
    localStorage.setItem('sidebarWidth', String(width));
  } catch {}
};

export const loadSidebarWidth = (): number => {
  try {
    const stored = localStorage.getItem('sidebarWidth');
    return stored ? parseInt(stored, 10) : 320;
  } catch {
    return 320;
  }
};

// Sidebar visible
export const saveSidebarVisible = (visible: boolean) => {
  try {
    localStorage.setItem('sidebarVisible', String(visible));
  } catch {}
};

export const loadSidebarVisible = (): boolean => {
  try {
    const stored = localStorage.getItem('sidebarVisible');
    return stored ? stored === 'true' : true;
  } catch {
    return true;
  }
};

// Spellcheck
export const loadSpellcheckDisabled = (): boolean => {
  try {
    const stored = localStorage.getItem('disableSpellcheck');
    return stored ? stored === 'true' : true;
  } catch {
    return true;
  }
};

export const saveSpellcheckDisabled = (value: boolean) => {
  try {
    localStorage.setItem('disableSpellcheck', value.toString());
  } catch {}
};
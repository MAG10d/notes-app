export type NoteType = 'normal' | 'material' | 'template';

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string; // Supports nested folders
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  type: NoteType;
  isFavorite: boolean;
  pinned?: boolean;
  groupId?: string; // Parent folder
  projectId?: string; // Reserved for future project system
}

export interface NotesStore {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
}

// Local database representation persisted in IndexedDB (Dexie)
export interface DbNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  type: NoteType;
  isFavorite?: boolean;
  pinned?: boolean;
  groupId?: string;
  version: number; // increment locally on each update; server uses updated_at/version
  deletedAt?: number | null;
}

export type OutboxOperation = 'upsert' | 'delete';

export interface OutboxItem {
  id: string;
  operation: OutboxOperation;
  noteId: string;
  // For upsert, include partial payload; for delete, optional
  payload?: Partial<DbNote>;
  createdAt: number;
}
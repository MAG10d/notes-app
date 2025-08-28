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
  groupId?: string; // Parent folder
  projectId?: string; // Reserved for future project system
}

export interface NotesStore {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
}

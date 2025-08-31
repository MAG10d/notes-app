import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { DbNote, OutboxItem } from './types'

export class NotesDatabase extends Dexie {
  notes!: Table<DbNote, string>
  outbox!: Table<OutboxItem, string>

  constructor() {
    super('notes-db')
    this.version(1).stores({
      notes: 'id, updatedAt, version, deletedAt, groupId, type',
      outbox: 'id, noteId, createdAt'
    })
  }
}

export const db = new NotesDatabase()



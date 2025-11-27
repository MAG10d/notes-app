// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { Editor } from './Editor';
import * as NotesContext from '../context/NotesContext';

// Mock the context
vi.mock('../context/NotesContext', () => ({
  useNotes: vi.fn(),
}));

describe('Editor Component', () => {
  it('should show "Show sidebar" button when sidebar is hidden and no group is selected (fallback view)', () => {
    const [sidebarVisible] = createSignal(false);
    const [selectedGroupId] = createSignal(undefined);
    const [selectedNote] = createSignal(null);
    const [editorContextMenu, setEditorContextMenu] = createSignal({ visible: false, x: 0, y: 0 });

    (NotesContext.useNotes as any).mockReturnValue({
      sidebarVisible,
      selectedGroupId,
      selectedNote,
      editorContextMenu,
      updateNote: vi.fn(),
      setEditorContextMenu,
      toggleSidebar: vi.fn(),
    });

    const div = document.createElement('div');
    createRoot(() => {
      div.appendChild(Editor() as Node);
    });

    // Check for the button
    const btn = div.querySelector('button[title="Show sidebar"]');
    expect(btn).not.toBeNull();
  });

  it('should show "Show sidebar" button when sidebar is hidden and no group is selected (active note view)', () => {
    const [sidebarVisible] = createSignal(false);
    const [selectedGroupId] = createSignal(undefined);
    const [selectedNote] = createSignal({ id: '1', title: 'Test', content: '' });
    const [editorContextMenu, setEditorContextMenu] = createSignal({ visible: false, x: 0, y: 0 });

    (NotesContext.useNotes as any).mockReturnValue({
      sidebarVisible,
      selectedGroupId,
      selectedNote,
      editorContextMenu,
      updateNote: vi.fn(),
      setEditorContextMenu,
      toggleSidebar: vi.fn(),
    });

    const div = document.createElement('div');
    createRoot(() => {
      div.appendChild(Editor() as Node);
    });

    // Check for the button
    const btn = div.querySelector('button[title="Show sidebar"]');
    expect(btn).not.toBeNull();
  });
});

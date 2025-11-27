import { Show, onCleanup, onMount, createEffect } from 'solid-js';
import { useNotes } from '../context/NotesContext';

export function Editor() {
  const {
    selectedNote,
    updateNote,
    editorContextMenu,
    setEditorContextMenu,
    sidebarVisible,
    toggleSidebar,
    selectedGroupId,
  } = useNotes();

  let editorEl: HTMLDivElement | null = null;
  let lastBoundId: string | null = null;

  const ensureSelectionInsideEditor = () => {
    if (!editorEl) return null;
    const selection = window.getSelection();
    if (!selection) return null;
    if (selection.rangeCount === 0 || !editorEl.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return selection;
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setEditorContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const selection = ensureSelectionInsideEditor() || window.getSelection();
      if (!selection) return;
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!range) return;
      const spaces = document.createTextNode('    ');
      range.insertNode(spaces);
      range.setStartAfter(spaces);
      range.setEndAfter(spaces);
      selection.removeAllRanges();
      selection.addRange(range);
      if (editorEl && selectedNote()) {
        updateNote(selectedNote()!.id, { content: editorEl.innerHTML });
      }
    }
  };

  const insertHtmlTable = (rows: number = 3, cols: number = 2) => {
    const note = selectedNote();
    if (!note || !editorEl) return;

    const selection = ensureSelectionInsideEditor() || window.getSelection();
    if (!selection) return;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range) return;

    const table = document.createElement('table');
    table.className = 'w-full max-w-full border border-gray-300 border-collapse text-sm my-2';

    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.className = 'border border-gray-300 px-2 py-1 text-left bg-gray-50';
      th.textContent = `Header ${c + 1}`;
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-2 py-1 align-top';
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    range.deleteContents();
    range.insertNode(table);

    const firstCell = tbody.querySelector('td') as HTMLTableCellElement | null;
    if (firstCell) {
      const newRange = document.createRange();
      newRange.selectNodeContents(firstCell);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    updateNote(note.id, { content: editorEl.innerHTML });
    editorEl.focus();
  };

  onMount(() => {
    document.addEventListener('contextmenu', globalCtxClose, true);
    document.addEventListener('click', globalClickClose, true);
  });

  onCleanup(() => {
    document.removeEventListener('contextmenu', globalCtxClose, true);
    document.removeEventListener('click', globalClickClose, true);
  });

  const globalCtxClose = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      setEditorContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const globalClickClose = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      setEditorContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  // Sync editor content when switching note
  createEffect(() => {
    const n = selectedNote();
    const currentId = n ? n.id : null;
    if (!editorEl) return;
    if (currentId !== lastBoundId) {
      editorEl.innerHTML = n?.content || '';
      lastBoundId = currentId;
    }
  });

  return (
    <div class="flex-1 flex flex-col min-w-0">
      <Show when={!!selectedNote()} fallback={
        <div class="flex-1 flex flex-col items-center justify-center bg-white relative">
          {/* Show sidebar button when hidden and ContentPanel is hidden (selectedGroupId is undefined) */}
          <Show when={!sidebarVisible() && selectedGroupId() === undefined}>
            <div class="absolute top-4 left-4">
               <button onClick={toggleSidebar} class="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer shadow-sm border border-gray-200" title="Show sidebar">
                <div class="i-f7:sidebar-left w-5 h-5" />
              </button>
            </div>
          </Show>
          <div class="text-center text-gray-500">
            <div class="i-f7:doc-text w-16 h-16 mb-4 mx-auto text-gray-400" />
            <h2 class="text-xl font-medium mb-2">Select a note to start editing</h2>
            <button
                onClick={() => useNotes().createNewNote()}
                class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer underline decoration-dotted underline-offset-4"
            >
                Or create a new note
            </button>
          </div>
        </div>
      }>
        {/* Header */}
        <div class="p-4 border-b border-gray-200 bg-white">
          <div class="flex items-center space-x-2">
            <Show when={!sidebarVisible() && selectedGroupId() === undefined}>
              <button onClick={toggleSidebar} class="p-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer flex-shrink-0" title="Show sidebar">
                <div class="i-f7:sidebar-left w-4 h-4" />
              </button>
            </Show>
            <input
              type="text"
              value={selectedNote()!.title}
              onInput={(e) => updateNote(selectedNote()!.id, { title: (e.target as HTMLInputElement).value })}
              spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
              class="text-xl font-semibold bg-transparent border-none outline-none flex-1"
              placeholder="Note title..."
            />
          </div>
        </div>

        {/* Contenteditable */}
        <div class="flex-1 p-4 bg-white overflow-x-auto overflow-y-auto editor-content" onContextMenu={(e) => handleContextMenu(e as unknown as MouseEvent)}>
          <div
            contentEditable
            onInput={(e) => {
              const html = (e.currentTarget as HTMLElement).innerHTML;
              updateNote(selectedNote()!.id, { content: html });
            }}
            onKeyDown={(e) => handleKeydown(e as unknown as KeyboardEvent)}
            ref={(el) => {
              editorEl = el as HTMLDivElement;
              const n = selectedNote();
              editorEl.innerHTML = n?.content || '';
              lastBoundId = n ? n.id : null;
            }}
            class="min-w-max h-full border-none outline-none text-gray-700 leading-relaxed font-mono"
            spellcheck="false" autocapitalize="off" autocorrect="off"
            lang="en-US"
            style="white-space: pre-wrap;"
          />
        </div>

        {/* Editor context menu */}
        <Show when={editorContextMenu().visible}>
          <div
            class="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 min-w-36"
            style={`left: ${editorContextMenu().x}px; top: ${editorContextMenu().y}px;`}
          >
            <button
              onClick={() => {
                insertHtmlTable(3, 2);
                setEditorContextMenu(prev => ({ ...prev, visible: false }));
              }}
              class="w-full text-left px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-xs text-gray-700 flex items-center space-x-2"
            >
              <div class="i-f7:table w-3 h-3" />
              <span>New Table</span>
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}
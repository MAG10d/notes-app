import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNotes } from '../context/NotesContext';

function htmlToPlainText(html: string): string {
  if (!html) return '';
  const normalized = html
    .replace(new RegExp('<\\s*br\\s*/?>', 'gi'), '\n')
    .replace(new RegExp('<\\s*/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\\s*>', 'gi'), '\n');
  const container = document.createElement('div');
  container.innerHTML = normalized;
  const text = container.textContent || container.innerText || '';
  return text;
}

export function ContentPanel() {
  const {
    // state
    notes,
    groups,
    selectedGroupId,
    sidebarVisible,
    sidebarWidth,

    // filters and sorting controls to align sorting with sidebar
    filterType,
    leftListSortKey,
    leftListSortOrder,
    leftListPinnedFirst,
    searchQuery,

    // actions
    toggleSidebar,
    selectNote,
    deleteNote,
    handleContextMenu,
    updateGroup,
  } = useNotes();

  const [isFolderPanelEditing, setIsFolderPanelEditing] = createSignal(false);
  const [folderPanelEditingTitle, setFolderPanelEditingTitle] = createSignal('');

  const sortNotesByPinAndUpdated = (arr: ReturnType<typeof notes>) => {
    const key = leftListSortKey();
    const order = leftListSortOrder();
    const pinnedFirst = leftListPinnedFirst();
    return [...arr].sort((a, b) => {
      if (pinnedFirst) {
        const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDelta !== 0) return pinDelta;
      }
      let delta = 0;
      if (key === 'updated') delta = a.updatedAt - b.updatedAt;
      else if (key === 'created') delta = a.createdAt - b.createdAt;
      else {
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        delta = at < bt ? -1 : at > bt ? 1 : 0;
      }
      if (order === 'desc') delta = -delta;
      if (delta !== 0) return delta;
      return b.updatedAt - a.updatedAt;
    });
  };

  const filteredNotes = createMemo(() => {
    let filtered = notes();
    const gid = selectedGroupId();
    if (gid) filtered = filtered.filter(n => n.groupId === gid);
    else if (gid === null && selectedGroupId() !== undefined) filtered = filtered.filter(n => !n.groupId);

    const f = filterType();
    if (f === 'favorites') filtered = filtered.filter(n => n.isFavorite);
    else if (f !== 'all') filtered = filtered.filter(n => n.type === f);

    const q = (searchQuery?.() || '').toLowerCase();
    if (q) {
      filtered = filtered.filter(n => (n.title || '').toLowerCase().includes(q) || htmlToPlainText(n.content || '').toLowerCase().includes(q));
    }
    return sortNotesByPinAndUpdated(filtered);
  });

  const contentPanelWidth = 280;

  return (
    <Show when={selectedGroupId() !== undefined}>
      <div class="bg-white border-r border-gray-200 flex flex-col" style={`width: ${contentPanelWidth}px; max-width: calc(100vw - ${sidebarWidth()}px);`}>
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center space-x-2">
            <Show when={!sidebarVisible()}>
              <button onClick={toggleSidebar} class="p-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer flex-shrink-0" title="Show sidebar">
                <div class="i-f7:sidebar-left w-4 h-4" />
              </button>
            </Show>
            <Show when={selectedGroupId() === null} fallback={(() => {
              const g = groups().find(gr => gr.id === selectedGroupId());
              return g
                ? (
                  <input
                    type="text"
                    value={isFolderPanelEditing() ? folderPanelEditingTitle() : g.name}
                    onInput={(e) => setFolderPanelEditingTitle((e.target as HTMLInputElement).value)}
                    onFocus={() => {
                      setIsFolderPanelEditing(true);
                      setFolderPanelEditingTitle(g.name);
                    }}
                    onBlur={(e) => {
                      const newTitle = (e.target as HTMLInputElement).value.trim();
                      if (newTitle && newTitle !== g.name) {
                        updateGroup(g.id, newTitle);
                      } else if (!newTitle) {
                        setFolderPanelEditingTitle(g.name);
                      }
                      setIsFolderPanelEditing(false);
                      setFolderPanelEditingTitle('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newTitle = (e.target as HTMLInputElement).value.trim();
                        if (newTitle && newTitle !== g.name) {
                          updateGroup(g.id, newTitle);
                        }
                        setIsFolderPanelEditing(false);
                        setFolderPanelEditingTitle('');
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setIsFolderPanelEditing(false);
                        setFolderPanelEditingTitle('');
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    class="text-lg font-semibold bg-transparent border-none outline-none w-full max-w-[240px]"
                    placeholder="Folder name..."
                  />
                )
                : <h2 class="text-lg font-semibold text-gray-800 max-w-[240px] truncate">Content</h2>;
            })()}>
              <h2 class="text-lg font-semibold text-gray-800 max-w-[240px] truncate">Ungrouped</h2>
            </Show>
            <span class="text-sm text-gray-500 flex-shrink-0">{filteredNotes().length} notes</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-2 pt-2 pb-2">
          <For each={filteredNotes()}>
            {(note) => (
              <div
                onClick={() => selectNote(note.id)}
                onContextMenu={(e) => handleContextMenu(e as unknown as MouseEvent, note.id)}
                classList={{
                  'group flex items-center space-x-2 p-3 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors text-gray-700': true,
                }}
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-1 mb-1">
                    <h3 class="font-medium truncate text-sm flex-1">{note.title || 'Untitled'}</h3>
                    <Show when={note.isFavorite}><div class="i-f7:star-fill w-3 h-3 text-yellow-500" /></Show>
                    <Show when={note.type === 'material'}><div class="i-f7:book w-3 h-3 text-gray-600" /></Show>
                    <Show when={note.type === 'template'}><div class="i-f7:rectangle-stack w-3 h-3 text-green-500" /></Show>
                  </div>
                  <p class="text-xs text-gray-500 truncate">
                    {(() => {
                      const text = htmlToPlainText(note.content || '');
                      return text ? (text.length > 60 ? text.substring(0, 60) + '...' : text) : 'Empty note';
                    })()}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">{new Date(note.updatedAt).toLocaleDateString('en-US')}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer">
                  <div class="i-f7:trash w-3 h-3" />
                </button>
              </div>
            )}
          </For>
          <Show when={filteredNotes().length === 0}>
            <div class="p-6 text-center text-gray-500">
              <div class="text-xs">{selectedGroupId() === null ? 'No notes in Ungrouped' : 'No notes in this folder'}</div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
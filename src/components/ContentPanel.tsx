import { For, Show, createMemo, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNotes } from '../context/NotesContext';
import { NoteItem } from './NoteItem';
import { CalendarView } from './CalendarView';
import { VIEW_ALL, VIEW_FAVORITES, VIEW_CALENDAR } from '../types';
import { clickOutside } from '../directives/clickOutside';

false && clickOutside;

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

    // filters and sorting controls
    filterType,
    searchQuery,

    // actions
    toggleSidebar,
    updateGroup,

    // sorting
    leftListSortKey,
    leftListSortOrder,
    leftListPinnedFirst,
    setLeftListSortKey,
    setLeftListSortOrder,
    setLeftListPinnedFirst,
    t,
  } = useNotes();

  const [isFolderPanelEditing, setIsFolderPanelEditing] = createSignal(false);
  const [folderPanelEditingTitle, setFolderPanelEditingTitle] = createSignal('');

  // Sort UI state
  const [sortDropdownOpen, setSortDropdownOpen] = createSignal(false);
  const [sortDropdownPos, setSortDropdownPos] = createSignal({ left: 0, top: 0 });
  let sortBtnEl: HTMLButtonElement | null = null;

  const updateSortDropdownPosition = () => {
    if (sortBtnEl) {
      const rect = sortBtnEl.getBoundingClientRect();
      setSortDropdownPos({ left: rect.right - 224, top: rect.bottom + 4 });
    }
  };

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

    // Smart Views logic
    if (gid === VIEW_ALL) {
       // All notes
    } else if (gid === VIEW_FAVORITES) {
       filtered = filtered.filter(n => n.isFavorite);
    } else if (gid === null) {
       // Ungrouped
       filtered = filtered.filter(n => !n.groupId);
    } else if (gid !== undefined) {
       // Specific group
       filtered = filtered.filter(n => n.groupId === gid);
    }

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

  // Title Logic
  const panelTitle = createMemo(() => {
      const gid = selectedGroupId();
      if (gid === VIEW_ALL) return t('views.all_notes');
      if (gid === VIEW_FAVORITES) return t('views.favorites');
      if (gid === null) return t('views.ungrouped');
      const g = groups().find(gr => gr.id === gid);
      return g ? g.name : t('content.default_title');
  });

  return (
    <Show when={selectedGroupId() !== undefined}>
      <div class="bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 flex flex-col" style={`width: ${contentPanelWidth}px; max-width: calc(100vw - ${sidebarWidth()}px);`}>
        <Show when={selectedGroupId() === VIEW_CALENDAR}>
            <CalendarView />
        </Show>
        <Show when={selectedGroupId() !== VIEW_CALENDAR}>
            <div class="p-4 border-b border-gray-200 dark:border-gray-800 h-[69px] box-border">
            <div class="flex items-center space-x-2 h-full">
                <Show when={!sidebarVisible()}>
              <button onClick={toggleSidebar} class="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer flex-shrink-0" title={t('app.sidebar_show')}>
                    <div class="i-f7:sidebar-left w-4 h-4" />
                </button>
                </Show>

                {/* Title / Folder Editing */}
                <div class="flex-1 min-w-0">
                    <Show when={() => {
                        const gid = selectedGroupId();
                        return gid !== VIEW_ALL && gid !== VIEW_FAVORITES && gid !== null && gid !== undefined;
                    }} fallback={
                     <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate" title={panelTitle()}>{panelTitle()}</h2>
                    }>
                        {(() => {
                            const g = groups().find(gr => gr.id === selectedGroupId());
                            return g ? (
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
                                    (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Escape') {
                                    setIsFolderPanelEditing(false);
                                    setFolderPanelEditingTitle('');
                                    (e.target as HTMLInputElement).blur();
                                }
                                }}
                            class="text-lg font-semibold bg-transparent border-none outline-none w-full text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                            placeholder={t('content.folder_placeholder')}
                            />
                        ) : <span>{t('content.default_title')}</span>
                        })()}
                    </Show>
                </div>

                <span class="text-sm text-gray-500 flex-shrink-0">{filteredNotes().length}</span>

                {/* Sort Button */}
                <button
                    ref={(el) => { sortBtnEl = el as HTMLButtonElement; }}
                    onClick={() => {
                        updateSortDropdownPosition();
                        setSortDropdownOpen(!sortDropdownOpen());
                    }}
                class="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer flex-shrink-0"
                title={t('content.sort_by')}
                >
                <div class="i-f7:line-horizontal-3-decrease w-4 h-4" />
                </button>

                <Show when={sortDropdownOpen()}>
                <Portal>
                    <div
                  class="fixed z-50 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow p-2 text-xs text-gray-700 dark:text-gray-300 space-y-2"
                    style={`left: ${sortDropdownPos().left}px; top: ${sortDropdownPos().top}px;`}
                    use:clickOutside={() => setSortDropdownOpen(false)}
                    >
                  <div class="font-medium text-gray-600 dark:text-gray-400 mb-1">{t('content.sort_by')}</div>
                    <div class="flex items-center justify-between">
                    <span>{t('content.sort_by')}</span>
                    <select class="px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" value={leftListSortKey()} onChange={(e) => setLeftListSortKey((e.target as HTMLSelectElement).value as any)}>
                      <option value="updated">{t('content.updated_time')}</option>
                      <option value="created">{t('content.created_time')}</option>
                      <option value="title">{t('content.title')}</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                    <span>{t('content.order')}</span>
                    <select class="px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" value={leftListSortOrder()} onChange={(e) => setLeftListSortOrder((e.target as HTMLSelectElement).value as any)}>
                      <option value="asc">{t('content.ascending')}</option>
                      <option value="desc">{t('content.descending')}</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                    <span>{t('content.pinned_first')}</span>
                    <button class={`${leftListPinnedFirst() ? 'bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500' : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'} px-2 py-1 rounded cursor-pointer`} onClick={() => setLeftListPinnedFirst(!leftListPinnedFirst())}>{leftListPinnedFirst() ? t('content.on') : t('content.off')}</button>
                    </div>
                    </div>
                </Portal>
                </Show>

            </div>
            </div>

            <div class="flex-1 overflow-y-auto px-2 pt-2 pb-2">
            <For each={filteredNotes()}>
                {(note) => <NoteItem note={note} />}
            </For>
            <Show when={filteredNotes().length === 0}>
            <div class="p-6 text-center text-gray-500 dark:text-gray-400">
                <div class="text-xs">
                  {searchQuery() ? t('content.no_matching_notes') : t('content.no_notes')}
                </div>
                </div>
            </Show>
            </div>
        </Show>
      </div>
    </Show>
  );
}

import { Show, For, onMount, onCleanup, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNotes } from '../context/NotesContext';
import { clickOutside } from '../directives/clickOutside';

false && clickOutside;

// --- FolderItem component ---
const FolderItem = (props: { group: any; index: number }) => {
  const {
    notes,
    groups,
    selectedGroupId,
    editingGroupId,
    draggedGroupId,
    insertIndex,
    selectGroup,
    selectNote,
    setEditingGroupId,
    updateGroup,
    deleteGroup,
    handleGroupDragStart,
    handleGroupDragOver,
    handleGroupDragLeave,
    handleGroupDrop,
    handleGroupDragEnd,
  } = useNotes();

  return (
    <div
      data-folder-item
      draggable={editingGroupId() !== props.group.id}
      onDragStart={(e) => handleGroupDragStart(e, props.group.id)}
      onDragOver={(e) => handleGroupDragOver(e, props.group.id)}
      onDragLeave={handleGroupDragLeave}
      onDrop={handleGroupDrop}
      onDragEnd={handleGroupDragEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (editingGroupId() === props.group.id) {
          const input = document.querySelector(`input[data-group-id="${props.group.id}"]`) as HTMLInputElement;
          if (input) updateGroup(props.group.id, input.value);
        } else {
          selectGroup(props.group.id);
          selectNote(null);
        }
      }}
      classList={{
        'group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors relative': true,
        'bg-gray-200 text-gray-900': selectedGroupId() === props.group.id,
        'text-gray-700': selectedGroupId() !== props.group.id,
        'opacity-50': draggedGroupId() === props.group.id,
      }}
    >
      {/* Insert indicator */}
      <Show when={insertIndex() === props.index}>
        <div
          class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
          style="top:-2px; left:-0.25rem; right:-0.25rem; transform: translateX(4px);"
        />
      </Show>
      
      <div class="i-f7:folder-fill w-4 h-4 text-gray-400 flex-shrink-0" />
      
      <Show
        when={editingGroupId() === props.group.id}
        fallback={
          <span 
            class="text-sm flex-1 truncate"
            onDblClick={(e) => {
              e.stopPropagation();
              setEditingGroupId(props.group.id);
              setTimeout(() => {
                const input = document.querySelector(`input[data-group-id="${props.group.id}"]`) as HTMLInputElement;
                if (input) {
                  input.focus();
                  input.select();
                }
              }, 10);
            }}
          >
            {props.group.name}
          </span>
        }
      >
        <input
          type="text"
          value={props.group.name}
          data-group-id={props.group.id}
          spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
          onBlur={(e) => updateGroup(props.group.id, (e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateGroup(props.group.id, (e.target as HTMLInputElement).value);
            else if (e.key === 'Escape') setEditingGroupId(null);
          }}
          class="text-sm flex-1 bg-transparent border border-gray-300 rounded px-1 outline-none focus:border-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      </Show>
      
      <span class="text-xs text-gray-500">({notes().filter(note => note.groupId === props.group.id).length})</span>
      <button
        onClick={(e) => { e.stopPropagation(); deleteGroup(props.group.id); }}
        class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer"
      >
        <div class="i-f7:trash w-3 h-3" />
      </button>

      {/* Bottom insert indicator */}
      <Show when={insertIndex() === groups().length && props.index === groups().length - 1}>
        <div
          class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
          style="bottom:-2px; left:-0.25rem; right:0.215rem; transform: translateX(4px);"
        />
      </Show>
    </div>
  );
};


// --- NoteItem component ---
const NoteItem = (props: { note: any }) => {
  const { selectedNoteId, selectNote, deleteNote, handleContextMenu } = useNotes();
  return (
    <div
      onClick={() => selectNote(props.note.id)}
      onContextMenu={(e) => handleContextMenu(e, props.note.id)}
      classList={{
        'group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors': true,
        'bg-gray-200 text-gray-900': selectedNoteId() === props.note.id,
        'text-gray-700': selectedNoteId() !== props.note.id,
      }}
    >
      <div class="i-f7:doc-text w-4 h-4 text-gray-400 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center space-x-1">
          <h3 class="font-medium truncate text-sm flex-1">
            {props.note.title || 'Untitled'}
          </h3>
          <Show when={props.note.pinned}><div class="i-f7:pin-fill w-3 h-3 text-gray-700" /></Show>
          <Show when={props.note.isFavorite}><div class="i-f7:star-fill w-3 h-3 text-yellow-500" /></Show>
          <Show when={props.note.type === 'material'}><div class="i-f7:book w-3 h-3 text-gray-600" /></Show>
          <Show when={props.note.type === 'template'}><div class="i-f7:rectangle-stack w-3 h-3 text-green-500" /></Show>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); deleteNote(props.note.id); }}
        class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 hover:bg-gray-200 rounded cursor-pointer"
      >
        <div class="i-f7:trash w-3 h-3" />
      </button>
    </div>
  );
};


// --- The main Sidebar component ---
export function Sidebar() {
  const {
    // States
    notes,
    groups,
    sidebarVisible,
    sidebarWidth,
    draggedGroupId,
    insertIndex,
    dropdownOpen,
    filtersVisible,
    filterType,
    searchQuery,
    leftListFilter,
    leftListDropdownOpen,
    leftListSortOpen,
    leftListSortKey,
    leftListSortOrder,
    leftListPinnedFirst,
    leftSortDropdownPos,

    // Derived states
    noteStats,
    sortedNotes, // Assuming you created this memo in the store

    // Actions
    toggleSidebar,
    createNewNote,
    setIsSearchModalOpen,
    setDropdownOpen,
    setFiltersVisible,
    setFilterType,
    createNewGroup,
    setInsertIndex,
    handleGroupDrop,
    setLeftListFilter,
    setLeftListDropdownOpen,
    setLeftListSortOpen,
    updateLeftSortDropdownPosition,
    setLeftListSortKey,
    setLeftListSortOrder,
    setLeftListPinnedFirst,
    handleMouseDown,
  } = useNotes();

  // Ref variables
  let leftSortBtnEl: HTMLButtonElement | null = null;
  let leftSortHeaderEl: HTMLDivElement | null = null;

  // Remove handleDocumentClick function, because we now use the clickOutside directive

  onMount(() => {
    const reposition = () => {
      if (leftListSortOpen() && leftSortBtnEl && leftSortHeaderEl) {
        updateLeftSortDropdownPosition(leftSortBtnEl, leftSortHeaderEl);
      }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    // store cleanup refs on window for removal
    (window as any).__sidebar_reposition__ = reposition;
  });

  onCleanup(() => {
    const reposition = (window as any).__sidebar_reposition__ as (() => void) | undefined;
    if (reposition) {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      delete (window as any).__sidebar_reposition__;
    }
  });

  // Recompute dropdown position when sidebar width changes or when menu opens
  createEffect(() => {
    const _w = sidebarWidth();
    if (leftListSortOpen() && leftSortBtnEl && leftSortHeaderEl) {
      requestAnimationFrame(() => updateLeftSortDropdownPosition(leftSortBtnEl!, leftSortHeaderEl!));
    }
    return _w;
  });
  createEffect(() => {
    if (leftListSortOpen() && leftSortBtnEl && leftSortHeaderEl) {
      requestAnimationFrame(() => updateLeftSortDropdownPosition(leftSortBtnEl!, leftSortHeaderEl!));
    }
    return leftListSortOpen();
  });

  return (
    <Show when={sidebarVisible()}>
      <div 
        class="bg-white border-r border-gray-200 flex flex-col relative" 
        style={`width: ${sidebarWidth()}px`}
        onDragOver={(e) => {
          if (draggedGroupId()) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          }
        }}
      >
        {/* Headers */}
        <div class="p-4 ">
          <div class="flex items-center justify-between mb-3">
            <h1 class="text-lg font-semibold text-gray-800">Light Notes</h1>
            <div class="flex items-center space-x-1">
              <button onClick={toggleSidebar} class="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer" title="Hide sidebar">
                <div class="i-f7:sidebar-left w-4 h-4" />
              </button>
              <button onClick={() => createNewNote()} class="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer" title="New note">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <button class="flex items-center space-x-2 p-2 w-full text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left cursor-pointer" onClick={() => { setIsSearchModalOpen(true); /* focus logic can be handled in the store or modal component */ }}>
            <div class="i-f7:search w-4 h-4 text-gray-400 flex-shrink-0" />
            <span class="text-sm text-gray-500">Search</span>
          </button>
        </div>

        {/* Folders Headers */}
        <div class="px-4 pb-1">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-600">Folders</span>
            <div class="relative dropdown-container">
              <button onClick={() => setDropdownOpen(!dropdownOpen())} class="p-1 text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer" title="More options">
                <div class="i-f7:plus w-4 h-4" />
              </button>
              <Show when={dropdownOpen()}>
                <div 
                  class="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                  use:clickOutside={() => setDropdownOpen(false)}
                >
                  <div class="py-1">
                    <button onClick={() => { setDropdownOpen(false); createNewNote('normal'); }} class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      <div class="i-f7:doc-text w-3 h-3 inline-block mr-2" />New normal note
                    </button>
                    <button onClick={() => { setDropdownOpen(false); createNewNote('material'); }} class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      <div class="i-f7:book w-3 h-3 inline-block mr-2" />New material note
                    </button>
                    <button onClick={() => { setDropdownOpen(false); createNewNote('template'); }} class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      <div class="i-f7:rectangle-stack w-3 h-3 inline-block mr-2" />New template note
                    </button>
                    <div class="border-t border-gray-200 my-1"></div>
                    <button onClick={() => { setDropdownOpen(false); createNewGroup(); }} class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      <div class="i-f7:folder w-3 h-3 inline-block mr-2" />New folder
                    </button>
                    <button onClick={() => { setDropdownOpen(false); setFiltersVisible(!filtersVisible()); }} class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                      <div class="i-f7:slider-horizontal-3 w-3 h-3 inline-block mr-2" />{filtersVisible() ? 'Hide filters' : 'Show filters'}
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
          <Show when={filtersVisible()}>
            <div class="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType('all')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'all',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'all',
                }}
              >
                All ({noteStats().all})
              </button>
              <button
                onClick={() => setFilterType('favorites')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'favorites',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'favorites',
                }}
              >
                <div class="i-f7:star-fill w-3 h-3 inline-block mr-1" />Favorites ({noteStats().favorites})
              </button>
              <button
                onClick={() => setFilterType('normal')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'normal',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'normal',
                }}
              >
                <div class="i-f7:doc-text w-3 h-3 inline-block mr-1" />Normal ({noteStats().normal})
              </button>
              <button
                onClick={() => setFilterType('material')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'material',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'material',
                }}
              >
                <div class="i-f7:book w-3 h-3 inline-block mr-1" />Material ({noteStats().material})
              </button>
              <button
                onClick={() => setFilterType('template')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'template',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'template',
                }}
              >
                <div class="i-f7:rectangle-stack w-3 h-3 inline-block mr-1" />Template ({noteStats().template})
              </button>
            </div>
          </Show>
        </div>

        {/* Folders List */}
        <div 
          class="px-2 pb-2"
          onDragOver={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-folder-item]') && draggedGroupId()) {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
              const container = e.currentTarget as HTMLElement;
              const items = container.querySelectorAll('[data-folder-item]');
              if (items.length === 0) { setInsertIndex(0); return; }
              const firstRect = items[0].getBoundingClientRect();
              const lastRect = items[items.length - 1].getBoundingClientRect();
              if (e.clientY < firstRect.top) setInsertIndex(0);
              else if (e.clientY > lastRect.bottom) setInsertIndex(items.length);
            }
          }}
          onDrop={handleGroupDrop}
        >
          <For each={groups()}>
            {(group, index) => <FolderItem group={group} index={index()} />}
          </For>
          <Show when={groups().length === 0 && insertIndex() !== null}>
            <div class="relative" style="height:0;">
              <div
                ref={(el) => {
                  (el as HTMLDivElement).style.opacity = '0';
                  requestAnimationFrame(() => {
                    (el as HTMLDivElement).style.transition = 'opacity 240ms ease-out';
                    (el as HTMLDivElement).style.opacity = '1';
                  });
                }}
                class="absolute left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
                style="top:-2px; left:-0.25rem; right:-0.25rem; transform: translateX(4px);"
              />
            </div>
          </Show>
        </div>

        {/* Notes List */}
        <div class="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-1 pb-2 border-t border-gray-100">
          <div ref={(el) => { leftSortHeaderEl = el as HTMLDivElement; }} class="px-2 py-2 text-xs font-medium text-gray-600 flex items-center gap-2 relative">
            <span>{leftListFilter() === 'all' ? 'All Notes' : 'Ungrouped only'}</span>
            <button class="p-1 rounded hover:bg-gray-100 cursor-pointer text-gray-600" title="Filter" onClick={() => setLeftListDropdownOpen(!leftListDropdownOpen())}>
              <div class="i-f7:chevron-down w-3 h-3" />
            </button>
            <button ref={(el) => { leftSortBtnEl = el as HTMLButtonElement; }} class="p-1 rounded hover:bg-gray-100 cursor-pointer text-gray-600 ml-auto" title="Sort" onClick={() => { setLeftListSortOpen(!leftListSortOpen()); requestAnimationFrame(() => { if (leftSortBtnEl && leftSortHeaderEl) updateLeftSortDropdownPosition(leftSortBtnEl, leftSortHeaderEl); }); }}>
              <div class="i-f7:line-horizontal-3-decrease w-3.5 h-3.5" />
            </button>
            <Show when={leftListDropdownOpen()}>
              <div 
                class="left-filter-dropdown absolute left-2 top-full mt-1 bg-white border border-gray-200 rounded-md shadow z-20" 
                style="width: calc(12rem - 12px)"
                use:clickOutside={() => setLeftListDropdownOpen(false)}
              >
                <button class={`w-full px-3 py-2 text-xs flex items-center ${leftListFilter()==='all' ? 'bg-gray-100 text-gray-800':'text-gray-700 hover:bg-gray-50'} cursor-pointer`} onClick={() => { setLeftListFilter('all'); setLeftListDropdownOpen(false); }}>
                  <span>All notes</span>
                  <span class="ml-auto text-gray-500">({notes().length})</span>
                </button>
                <button class={`w-full px-3 py-2 text-xs flex items-center ${leftListFilter()==='ungrouped' ? 'bg-gray-100 text-gray-800':'text-gray-700 hover:bg-gray-50'} cursor-pointer`} onClick={() => { setLeftListFilter('ungrouped'); setLeftListDropdownOpen(false); }}>
                  <span>Ungrouped only</span>
                  <span class="ml-auto text-gray-500">({notes().filter(n => !n.groupId).length})</span>
                </button>
              </div>
            </Show>
            <Show when={leftListSortOpen()}>
              <Portal>
                <div 
                  class="left-sort-dropdown fixed z-50 w-56 bg-white border border-gray-200 rounded-md shadow p-2 text-xs text-gray-700 space-y-2" 
                  style={`left: ${leftSortDropdownPos().left}px; top: ${leftSortDropdownPos().top}px;`}
                  use:clickOutside={() => setLeftListSortOpen(false)}
                >
                  <div class="font-medium text-gray-600 mb-1">Sort</div>
                  <div class="flex items-center justify-between">
                    <span>Sort by</span>
                    <select class="px-3 py-2 text-xs rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer" value={leftListSortKey()} onChange={(e) => setLeftListSortKey((e.target as HTMLSelectElement).value as any)}>
                      <option value="updated">Updated time</option>
                      <option value="created">Created time</option>
                      <option value="title">Title</option>
                    </select>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Order</span>
                    <select class="px-3 py-2 text-xs rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer" value={leftListSortOrder()} onChange={(e) => setLeftListSortOrder((e.target as HTMLSelectElement).value as any)}>
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Pinned first</span>
                    <button class={`${leftListPinnedFirst() ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} px-2 py-1 rounded cursor-pointer`} onClick={() => setLeftListPinnedFirst(!leftListPinnedFirst())}>{leftListPinnedFirst() ? 'On' : 'Off'}</button>
                  </div>
                </div>
              </Portal>
            </Show>
          </div>
          <For each={sortedNotes() /* using the memo calculated in the store */}>
            {(note) => <NoteItem note={note} />}
          </For>
          <Show when={sortedNotes().length === 0}>
            <div class="p-6 text-center text-gray-500">
              <div class="text-xs">
                {leftListFilter() === 'all' 
                  ? (searchQuery() ? 'No matching notes found' : 'No notes yet, click the button above to start writing')
                  : 'No ungrouped notes'}
              </div>
            </div>
          </Show>
        </div>
        
        {/* Resize Handle */}
        <div 
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-gray-200 transition-colors"
          onMouseDown={handleMouseDown}
        />
      </div>
    </Show>
  );
}
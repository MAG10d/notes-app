import { Show, For } from 'solid-js';
import { useNotes } from '../context/NotesContext';
import { clickOutside } from '../directives/clickOutside';
import { VIEW_ALL, VIEW_FAVORITES } from '../types';

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
    selectedGroupId,
    noteStats,

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
    handleMouseDown,
    selectGroup,
    selectNote,
  } = useNotes();

  // Helper for Smart Views
  const SmartViewItem = (props: { id: string | null, name: string, icon: string, count: number, color?: string }) => (
    <div
      onClick={() => {
        selectGroup(props.id);
        selectNote(null);
      }}
      classList={{
        'group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors': true,
        'bg-gray-200 text-gray-900': selectedGroupId() === props.id,
        'text-gray-700': selectedGroupId() !== props.id,
      }}
    >
      <div class={`${props.icon} w-4 h-4 ${props.color || 'text-gray-400'} flex-shrink-0`} />
      <span class="text-sm flex-1 truncate font-medium">{props.name}</span>
      <span class="text-xs text-gray-500">({props.count})</span>
    </div>
  );

  return (
    <Show when={sidebarVisible()}>
      <div 
        class="bg-white border-r border-gray-200 flex flex-col relative h-full"
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
          <button class="flex items-center space-x-2 p-2 w-full text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left cursor-pointer" onClick={() => { setIsSearchModalOpen(true); }}>
            <div class="i-f7:search w-4 h-4 text-gray-400 flex-shrink-0" />
            <span class="text-sm text-gray-500">Search</span>
          </button>
        </div>

        {/* Smart Views */}
        <div class="px-2 pb-2">
            <SmartViewItem id={VIEW_ALL} name="All Notes" icon="i-f7:doc-on-doc" count={noteStats().all} />
            <SmartViewItem id={VIEW_FAVORITES} name="Favorites" icon="i-f7:star-fill" count={noteStats().favorites} color="text-yellow-500" />
            <SmartViewItem id={null} name="Ungrouped" icon="i-f7:tray" count={notes().filter(n => !n.groupId).length} />
        </div>

        <div class="border-t border-gray-100 my-2 mx-4"></div>

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
             {/* Filter buttons can stay here or move to ContentPanel.
                 Keeping them here acts as global type filter which is fine,
                 but duplicates ContentPanel potential.
                 Let's keep them here for now as "Folder filters".
             */}
            <div class="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterType('all')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'all',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'all',
                }}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('normal')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'normal',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'normal',
                }}
              >
                Normal
              </button>
              <button
                onClick={() => setFilterType('material')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'material',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'material',
                }}
              >
                Material
              </button>
              <button
                onClick={() => setFilterType('template')}
                classList={{
                  'px-2 py-1 text-xs rounded cursor-pointer transition-colors': true,
                  'bg-gray-200 text-gray-800': filterType() === 'template',
                  'text-gray-600 hover:bg-gray-100': filterType() !== 'template',
                }}
              >
                Template
              </button>
            </div>
          </Show>
        </div>

        {/* Folders List */}
        <div 
          class="flex-1 overflow-y-auto px-2 pb-2"
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
        
        {/* Resize Handle */}
        <div 
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-gray-200 transition-colors"
          onMouseDown={handleMouseDown}
        />
      </div>
    </Show>
  );
}
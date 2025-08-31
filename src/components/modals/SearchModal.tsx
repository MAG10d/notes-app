import { For, Show } from 'solid-js';
import { useNotes } from '../../context/NotesContext';

export function SearchModal() {
  const {
    setIsSearchModalOpen,
    searchModalQuery,
    setSearchModalQuery,
    searchModalResults,
    selectNote,
  } = useNotes();

  let searchInputEl: HTMLInputElement | null = null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30" onClick={() => setIsSearchModalOpen(false)} />
      <div class="relative bg-white rounded-lg shadow-xl border border-gray-200 w-[720px] max-w-[95vw] h-[560px] max-h-[90%] overflow-hidden p-0">
        <div class="flex flex-col h-full">
          <div class="p-3 border-b border-gray-200 flex items-center gap-2">
            <div class="i-f7:search w-4 h-4 text-gray-500" />
            <input
              type="text"
              ref={(el) => { searchInputEl = el as HTMLInputElement; setTimeout(() => searchInputEl?.focus(), 0); }}
              value={searchModalQuery()}
              onInput={(e) => setSearchModalQuery((e.target as HTMLInputElement).value)}
              spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
              placeholder="Search notes..."
              class="flex-1 bg-transparent outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const first = searchModalResults()[0];
                  if (first) {
                    selectNote(first.id);
                    setIsSearchModalOpen(false);
                  }
                }
              }}
            />
            <button class="p-1 rounded hover:bg-gray-100 cursor-pointer" onClick={() => setIsSearchModalOpen(false)} title="Close" aria-label="Close">
              <div class="i-f7:xmark w-5 h-5" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <Show when={searchModalQuery().trim() === ''} fallback={
              <For each={searchModalResults()}>
                {(note) => (
                  <div
                    class="p-2 rounded hover:bg-gray-50 cursor-pointer border-b border-gray-50"
                    onClick={() => { selectNote(note.id); setIsSearchModalOpen(false); }}
                  >
                    <div class="text-sm font-medium text-gray-800 truncate">{note.title || 'Untitled'}</div>
                    <div class="text-xs text-gray-500 truncate">
                      {(() => {
                        const div = document.createElement('div');
                        div.innerHTML = note.content || '';
                        const text = div.textContent || div.innerText || '';
                        return text ? (text.length > 100 ? text.substring(0, 100) + '...' : text) : 'Empty note';
                      })()}
                    </div>
                  </div>
                )}
              </For>
            }>
              <div class="text-center text-gray-400 text-sm mt-10">Type to search notes</div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
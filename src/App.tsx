import { Show } from 'solid-js';
import { useNotes } from './context/NotesContext';
import { Sidebar } from './components/Sidebar';
import { ContentPanel } from './components/ContentPanel';
import { Editor } from './components/Editor';
import { MainModal } from './components/modals/MainModal';
import { SearchModal } from './components/modals/SearchModal';

function App() {
  // Get the status needed from the context
  const { 
    isMainModalOpen, 
    isSearchModalOpen, 
    setIsMainModalOpen, 
    setActiveModalTab,
    user,
  } = useNotes();

  return (
    <div class="flex h-screen bg-gray-50 overflow-x-hidden w-full">
      <Sidebar />
      <ContentPanel />
      <Editor />

      {/* Floating bottom-left actions */}
      <div class="fixed left-4 bottom-4 z-40 flex items-center gap-2">
        {/* Account pill */}
        <button
          onClick={() => { setActiveModalTab('account'); setIsMainModalOpen(true); }}
          class="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-gray-200 shadow text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Account"
        >
          <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <div class="i-f7:person w-4 h-4" />
          </div>
          <span class="text-sm">
            <Show when={user()} fallback="Guest">
              {user()?.email}
            </Show>
          </span>
        </button>

        {/* Settings circle */}
        <button
          onClick={() => { setActiveModalTab('settings'); setIsMainModalOpen(true); }}
          class="w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Settings"
        >
          <div class="i-f7:gear-alt w-5 h-5" />
        </button>
      </div>

      {/* Use <Show> component to do conditional rendering */}
      <Show when={isMainModalOpen()}>
        <MainModal />
      </Show>
      <Show when={isSearchModalOpen()}>
        <SearchModal />
      </Show>
    </div>
  );
}

export default App;
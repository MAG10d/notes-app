import { Show } from 'solid-js';
import { useNotes } from '../../context/NotesContext';

export function MainModal() {
  // Get all the states and functions needed for this component from the context
  const {
    // Control the status of the Modal
    activeModalTab,
    setActiveModalTab,
    setIsMainModalOpen,

    // The status and functions needed for the tabs
    sidebarVisible,
    toggleSidebar,
    spellcheckDisabled,
    setSpellcheckDisabled,
  } = useNotes();
  
  // Apply the browser spellcheck attribute to the entire document tree
  const applySpellcheckToTree = (disable: boolean, root: ParentNode = document) => {
    const nodes = root.querySelectorAll('input, textarea, [contenteditable], [contenteditable="true"]');
    nodes.forEach((el) => {
      if (disable) {
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('autocapitalize', 'off');
        el.setAttribute('autocorrect', 'off');
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.setAttribute('autocomplete', 'off');
      } else {
        el.setAttribute('spellcheck', 'true');
        el.removeAttribute('autocapitalize');
        el.removeAttribute('autocorrect');
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.setAttribute('autocomplete', 'on');
      }
    });
  };

  // Toggle the browser spellcheck status
  const handleToggleSpellcheck = () => {
    const next = !spellcheckDisabled();
    setSpellcheckDisabled(next);
    try { localStorage.setItem('disableSpellcheck', next.toString()); } catch {}
    applySpellcheckToTree(next);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background mask */}
      <div
        class="absolute inset-0 bg-black/30"
        onClick={() => setIsMainModalOpen(false)}
      />
      
      {/* Modal body */}
      <div class="relative bg-white rounded-lg shadow-xl border border-gray-200 w-[720px] max-w-[95vw] h-[560px] max-h-[90%] overflow-hidden p-0">
        <div class="flex h-full">
          
          {/* Left menu */}
          <div class="w-48 border-r border-gray-200 p-3 overflow-y-auto">
            <div class="text-xs text-gray-500 mb-2 px-2">Menu</div>
            <button
              classList={{
                'w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2': true,
                'bg-gray-100 text-gray-900': activeModalTab() === 'account',
                'text-gray-700 hover:bg-gray-50': activeModalTab() !== 'account',
              }}
              onClick={() => setActiveModalTab('account')}
            >
              <div class="i-f7:person w-4 h-4" />
              <span class="text-sm">Account</span>
            </button>
            <button
              classList={{
                'w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2 mt-1': true,
                'bg-gray-100 text-gray-900': activeModalTab() === 'settings',
                'text-gray-700 hover:bg-gray-50': activeModalTab() !== 'settings',
              }}
              onClick={() => setActiveModalTab('settings')}
            >
              <div class="i-f7:gear-alt w-4 h-4" />
              <span class="text-sm">Settings</span>
            </button>
          </div>

          {/* Right content area */}
          <div class="flex-1 p-4 overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800">
                {activeModalTab() === 'account' ? 'Account' : 'Settings'}
              </h3>
              <button
                class="p-1 rounded hover:bg-gray-100 cursor-pointer"
                onClick={() => setIsMainModalOpen(false)}
                aria-label="Close"
                title="Close"
              >
                <div class="i-f7:xmark w-5 h-5" />
              </button>
            </div>

            {/* Conditional rendering of content */}
            <Show when={activeModalTab() === 'account'}>
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                  <div class="i-f7:person w-6 h-6" />
                </div>
                <div>
                  <div class="text-sm text-gray-700">Guest</div>
                  <div class="text-xs text-gray-500">Not signed in</div>
                </div>
                <div class="ml-auto">
                  <button class="px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-700 cursor-pointer">Sign in</button>
                </div>
              </div>
            </Show>
            
            <Show when={activeModalTab() === 'settings'}>
              <div class="space-y-3 text-sm text-gray-700">
                <div class="flex items-center justify-between">
                  <span>Sidebar visible</span>
                  <button
                    class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer"
                    onClick={() => {
                      toggleSidebar();
                      setIsMainModalOpen(false);
                    }}
                  >
                    {sidebarVisible() ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <span>Disable browser spellcheck</span>
                  <button
                    classList={{
                        'px-2 py-1 rounded cursor-pointer': true,
                        'bg-gray-800 text-white hover:bg-gray-700': spellcheckDisabled(),
                        'bg-gray-100 text-gray-800 hover:bg-gray-200': !spellcheckDisabled(),
                    }}
                    onClick={handleToggleSpellcheck}
                  >
                    {spellcheckDisabled() ? 'On' : 'Off'}
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <span>Language</span>
                  <div class="flex items-center gap-2">
                    <select class="px-2 py-1 rounded bg-gray-100 text-gray-500 cursor-not-allowed" disabled>
                      <option>System</option>
                      <option>English</option>
                      <option>繁體中文</option>
                    </select>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span>Theme</span>
                  <div class="flex items-center gap-2">
                    <select class="px-2 py-1 rounded bg-gray-100 text-gray-500 cursor-not-allowed" disabled>
                      <option>System</option>
                      <option>Light</option>
                      <option>Dark</option>
                    </select>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
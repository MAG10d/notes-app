import { Show, For } from 'solid-js';
import { useNotes } from '../../context/NotesContext';
import { Auth } from '../auth/Auth';
import { languages } from '../../i18n';

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

    // I18n and Theme
    language,
    setLanguage,
    theme,
    setTheme,
    t,
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
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Menu</div>
            <button
              classList={{
                'w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2': true,
                'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100': activeModalTab() === 'account',
                'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800': activeModalTab() !== 'account',
              }}
              onClick={() => setActiveModalTab('account')}
            >
              <div class="i-f7:person w-4 h-4" />
              <span class="text-sm">{t('auth.account')}</span>
            </button>
            <button
              classList={{
                'w-full text-left px-2 py-2 rounded cursor-pointer flex items-center gap-2 mt-1': true,
                'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100': activeModalTab() === 'settings',
                'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800': activeModalTab() !== 'settings',
              }}
              onClick={() => setActiveModalTab('settings')}
            >
              <div class="i-f7:gear-alt w-4 h-4" />
              <span class="text-sm">{t('settings.title')}</span>
            </button>
          </div>

          {/* Right content area */}
          <div class="flex-1 p-4 overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                {activeModalTab() === 'account' ? t('auth.account') : t('settings.title')}
              </h3>
              <button
                class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-500 dark:text-gray-400"
                onClick={() => setIsMainModalOpen(false)}
                aria-label={t('settings.close')}
                title={t('settings.close')}
              >
                <div class="i-f7:xmark w-5 h-5" />
              </button>
            </div>

            {/* Conditional rendering of content */}
            <Show when={activeModalTab() === 'account'}>
                            <Auth /> {/* Render the Auth component here */}
            </Show>
            
            <Show when={activeModalTab() === 'settings'}>
              <div class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="flex items-center justify-between">
                  <span>{sidebarVisible() ? t('app.sidebar_hide') : t('app.sidebar_show')}</span>
                  <button
                    class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 cursor-pointer"
                    onClick={() => {
                      toggleSidebar();
                      setIsMainModalOpen(false);
                    }}
                  >
                    {sidebarVisible() ? t('content.on') : t('content.off')}
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <span>{t('settings.spellcheck')}</span>
                  <button
                    classList={{
                        'px-2 py-1 rounded cursor-pointer transition-colors': true,
                        'bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500': spellcheckDisabled(),
                        'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600': !spellcheckDisabled(),
                    }}
                    onClick={handleToggleSpellcheck}
                  >
                    {spellcheckDisabled() ? t('content.on') : t('content.off')}
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <span>{t('settings.language')}</span>
                  <div class="flex items-center gap-2">
                    <select
                      class="px-2 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 cursor-pointer border-none outline-none"
                      value={language()}
                      onChange={(e) => setLanguage(e.currentTarget.value as any)}
                    >
                      <For each={languages}>
                        {(lang) => <option value={lang.code}>{lang.label}</option>}
                      </For>
                    </select>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span>{t('settings.theme')}</span>
                  <div class="flex items-center gap-2">
                    <select
                      class="px-2 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 cursor-pointer border-none outline-none"
                      value={theme()}
                      onChange={(e) => setTheme(e.currentTarget.value as any)}
                    >
                      <option value="light">{t('settings.light')}</option>
                      <option value="dark">{t('settings.dark')}</option>
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
import { createSignal, createMemo, For, Show } from 'solid-js';
import { useNotes } from '../context/NotesContext';
import { NoteItem } from './NoteItem';

export function CalendarView() {
  const { notes, createNewNote, sidebarVisible, toggleSidebar, t, language } = useNotes();
  const [currentDate, setCurrentDate] = createSignal(new Date());
  const [selectedDate, setSelectedDate] = createSignal<Date>(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const currentYear = () => currentDate().getFullYear();
  const currentMonth = () => currentDate().getMonth();

  const daysInMonth = createMemo(() => getDaysInMonth(currentYear(), currentMonth()));
  const firstDay = createMemo(() => getFirstDayOfMonth(currentYear(), currentMonth()));

  const monthNames = () => t('calendar.months') as unknown as string[];
  const weekDays = () => t('calendar.weekdays') as unknown as string[];

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear(), currentMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear(), currentMonth() + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const notesInMonth = createMemo(() => {
     const year = currentYear();
     const month = currentMonth();
     return notes().reduce((acc, note) => {
         const d = new Date(note.createdAt);
         if (d.getFullYear() === year && d.getMonth() === month) {
             acc.add(d.getDate());
         }
         return acc;
     }, new Set<number>());
  });

  // Helper to check if a date has any notes
  const hasNotes = (day: number) => {
    return notesInMonth().has(day);
  };

  const notesForSelectedDate = createMemo(() => {
      const target = selectedDate();
      return notes().filter(note => {
          const noteDate = new Date(note.createdAt);
          return isSameDay(noteDate, target);
      }).sort((a, b) => b.createdAt - a.createdAt);
  });

  const handleCreateNote = () => {
      // Set time to current time but on the selected date
      const now = new Date();
      const target = new Date(selectedDate());
      target.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      createNewNote('normal', target.getTime());
  };

  return (
    <div class="flex flex-col h-full bg-white dark:bg-black">
      {/* Calendar Header */}
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div class="flex items-center space-x-2">
            <Show when={!sidebarVisible()}>
              <button onClick={toggleSidebar} class="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer flex-shrink-0" title={t('app.sidebar_show')}>
                <div class="i-f7:sidebar-left w-4 h-4" />
              </button>
            </Show>
            <button onClick={prevMonth} class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer">
                <div class="i-f7:chevron-left w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
        </div>
        <span class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {monthNames()[currentMonth()]} {currentYear()}
        </span>
        <button onClick={nextMonth} class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer">
          <div class="i-f7:chevron-right w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div class="grid grid-cols-7 gap-1 p-2 border-b border-gray-200 dark:border-gray-800">
        {/* Weekday headers */}
        <For each={weekDays()}>
          {(day) => <div class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">{day}</div>}
        </For>

        {/* Empty cells for previous month */}
        <For each={Array(firstDay())}>
          {() => <div />}
        </For>

        {/* Days */}
        <For each={Array.from({ length: daysInMonth() }, (_, i) => i + 1)}>
          {(day) => {
            const date = () => new Date(currentYear(), currentMonth(), day);
            const isSelected = () => isSameDay(date(), selectedDate());
            const isToday = () => isSameDay(date(), new Date());
            const hasNote = () => hasNotes(day);

            return (
              <div
                onClick={() => setSelectedDate(date())}
                classList={{
                  'aspect-square flex flex-col items-center justify-center rounded-full cursor-pointer text-sm transition-colors relative': true,
                  'bg-blue-500 text-white': isSelected(),
                  'hover:bg-blue-100 dark:hover:bg-blue-900/40': !isSelected(),
                  'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100': !isSelected() && isToday(),
                  'text-gray-700 dark:text-gray-300': !isSelected() && !isToday(),
                  'font-semibold': isToday(),
                }}
              >
                <span>{day}</span>
                <Show when={hasNote() && !isSelected()}>
                    <div class="w-1 h-1 bg-blue-500 rounded-full absolute bottom-1"></div>
                </Show>
                 <Show when={hasNote() && isSelected()}>
                    <div class="w-1 h-1 bg-white rounded-full absolute bottom-1"></div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Selected Date Header & Actions */}
      <div class="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span class="font-medium text-gray-700 dark:text-gray-300">
              {selectedDate().toLocaleDateString(language() === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <button
            onClick={handleCreateNote}
            class="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded cursor-pointer"
            title={t('calendar.create_note')}
          >
              <div class="i-f7:plus w-5 h-5" />
          </button>
      </div>

      {/* Notes List for Selected Date */}
      <div class="flex-1 overflow-y-auto p-2">
        <Show when={notesForSelectedDate().length > 0} fallback={
            <div class="text-center text-gray-400 dark:text-gray-600 mt-10 text-sm">{t('calendar.no_notes')}</div>
        }>
             <For each={notesForSelectedDate()}>
                {(note) => <NoteItem note={note} />}
            </For>
        </Show>
      </div>
    </div>
  );
}

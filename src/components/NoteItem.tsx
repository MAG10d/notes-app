import { Show } from 'solid-js';
import { useNotes } from '../context/NotesContext';
import { htmlToPlainText } from '../lib/editor';

export const NoteItem = (props: { note: any }) => {
  const { selectedNoteId, selectNote, deleteNote, handleContextMenu } = useNotes();
  return (
    <div
      onClick={() => selectNote(props.note.id)}
      onContextMenu={(e) => handleContextMenu(e, props.note.id)}
      classList={{
        'group flex items-center space-x-2 p-2 mx-1 mb-1 cursor-pointer hover:bg-gray-100 rounded-md transition-colors text-gray-700': true,
        'bg-gray-200 text-gray-900': selectedNoteId() === props.note.id,
        'text-gray-700': selectedNoteId() !== props.note.id,
      }}
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center space-x-1 mb-1">
          <h3 class="font-medium truncate text-sm flex-1">
            {props.note.title || 'Untitled'}
          </h3>
          <Show when={props.note.pinned}><div class="i-f7:pin-fill w-3 h-3 text-gray-700" /></Show>
          <Show when={props.note.isFavorite}><div class="i-f7:star-fill w-3 h-3 text-yellow-500" /></Show>
          <Show when={props.note.type === 'material'}><div class="i-f7:book w-3 h-3 text-gray-600" /></Show>
          <Show when={props.note.type === 'template'}><div class="i-f7:rectangle-stack w-3 h-3 text-green-500" /></Show>
        </div>
        <p class="text-xs text-gray-500 truncate">
          {(() => {
            const text = htmlToPlainText(props.note.content || '');
            return text ? (text.length > 60 ? text.substring(0, 60) + '...' : text) : 'Empty note';
          })()}
        </p>
        <p class="text-xs text-gray-400 mt-1">{new Date(props.note.updatedAt).toLocaleDateString('en-US')}</p>
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

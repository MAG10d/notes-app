import { createContext, useContext } from 'solid-js';
import type { ParentComponent } from 'solid-js';
import { createNotesStore } from '../stores/createNotesStore';

// Use ReturnType to automatically infer the type of the store, which is very convenient
type NotesStoreType = ReturnType<typeof createNotesStore>;
const NotesContext = createContext<NotesStoreType>();

export const NotesProvider: ParentComponent = (props) => {
    const store = createNotesStore();
    return (
        <NotesContext.Provider value={store}>
            {props.children}
        </NotesContext.Provider>
    );
};

// Create a custom Hook so that child components can easily use the store
export function useNotes() {
    const context = useContext(NotesContext);
    if (!context) {
        throw new Error('useNotes must be used within a NotesProvider');
    }
    return context;
}
import { createSignal, createMemo, onMount, createEffect, batch, onCleanup } from 'solid-js'; // Added onCleanup
import type { Note, NoteType, Group } from '../types';
import {
  loadFromStorage, saveToStorage,
  loadGroupsFromStorage, saveGroupsToStorage,
  loadSelectedNoteId, saveSelectedNoteId,
  loadSelectedGroupId, saveSelectedGroupId,
  loadSidebarWidth, saveSidebarWidth,
  loadSidebarVisible, saveSidebarVisible,
  loadSpellcheckDisabled,
} from '../services/storage.ts';
import { htmlToPlainText } from '../lib/editor.ts';
import { supabase } from '../lib/supabase'; // Import supabase
import type { Session, User } from '@supabase/supabase-js'; // Import Supabase types

export function createNotesStore() {
  // --- STATE (Signals) ---
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [groups, setGroups] = createSignal<Group[]>([]);
  const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = createSignal(320);
  const [isResizing, setIsResizing] = createSignal(false);
  const [sidebarVisible, setSidebarVisible] = createSignal(true);
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{visible: boolean, x: number, y: number, noteId: string | null}>({ visible: false, x: 0, y: 0, noteId: null });
  const [editorContextMenu, setEditorContextMenu] = createSignal<{visible: boolean, x: number, y: number}>({ visible: false, x: 0, y: 0 });
  const [filterType, setFilterType] = createSignal<'all' | NoteType | 'favorites'>('all');
  const [filtersVisible, setFiltersVisible] = createSignal(false);
  const [editingGroupId, setEditingGroupId] = createSignal<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = createSignal<string | null>(null);
  const [insertIndex, setInsertIndex] = createSignal<number | null>(null);
  const [isMainModalOpen, setIsMainModalOpen] = createSignal(false);
  const [activeModalTab, setActiveModalTab] = createSignal<'account' | 'settings'>('account');
  const [isSearchModalOpen, setIsSearchModalOpen] = createSignal(false);
  const [searchModalQuery, setSearchModalQuery] = createSignal('');
  
  // Sidebar List State
  const [leftListFilter, setLeftListFilter] = createSignal<'all' | 'ungrouped'>('all');
  const [leftListDropdownOpen, setLeftListDropdownOpen] = createSignal(false);
  const [leftListSortOpen, setLeftListSortOpen] = createSignal(false);
  const [leftListSortKey, setLeftListSortKey] = createSignal<'updated' | 'created' | 'title'>('updated');
  const [leftListSortOrder, setLeftListSortOrder] = createSignal<'asc' | 'desc'>('desc');
  const [leftListPinnedFirst, setLeftListPinnedFirst] = createSignal(true);
  const [leftSortDropdownPos, setLeftSortDropdownPos] = createSignal<{ left: number, top: number }>({ left: 0, top: 0 });

  const [spellcheckDisabled, setSpellcheckDisabled] = createSignal<boolean>(loadSpellcheckDisabled());
  let selectionRestored = false;

  // Supabase Auth State
  const [session, setSession] = createSignal<Session | null>(null);
  const [user, setUser] = createSignal<User | null>(null);
  const [authLoading, setAuthLoading] = createSignal(true);
  const [authError, setAuthError] = createSignal<string | null>(null);
  const [isMfaRequired, setIsMfaRequired] = createSignal(false); // Indicates if MFA is required for sign-in
  const [mfaEnrollmentData, setMfaEnrollmentData] = createSignal<{
    secret: string;
    qrCode: string; // SVG QR Code
    factorId: string;
  } | null>(null); // For 2FA setup flow


  const selectedNote = createMemo(() => {
    const id = selectedNoteId();
    return id ? notes().find(note => note.id === id) : null;
  });

  const noteStats = createMemo(() => {
    const allNotes = notes();
    return {
      all: allNotes.length,
      favorites: allNotes.filter(note => note.isFavorite).length,
      normal: allNotes.filter(note => note.type === 'normal').length,
      material: allNotes.filter(note => note.type === 'material').length,
      template: allNotes.filter(note => note.type === 'template').length
    };
  });

  const sortedNotes = createMemo(() => {
    const base = leftListFilter() === 'all' ? notes() : notes().filter(n => !n.groupId);
    return [...base].sort((a, b) => {
      if (leftListPinnedFirst()) {
        const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDelta !== 0) return pinDelta;
      }
      const key = leftListSortKey();
      const dir = leftListSortOrder() === 'asc' ? 1 : -1;
      let delta = 0;
      if (key === 'updated') delta = (a.updatedAt - b.updatedAt) * dir;
      else if (key === 'created') delta = (a.createdAt - b.createdAt) * dir;
      else {
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        delta = at.localeCompare(bt) * dir;
      }
      if (delta !== 0) return delta;
      // Tie-breaker: updated desc
      return b.updatedAt - a.updatedAt;
    });
  });

  const searchModalResults = createMemo(() => {
    const q = searchModalQuery().trim().toLowerCase();
    if (!q) return [] as Note[];
    return notes().filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      htmlToPlainText(n.content || '').toLowerCase().includes(q)
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  });
  
  // --- ACTIONS (Functions) ---

  const selectNote = (id: string | null) => {
    setSelectedNoteId(id);
    saveSelectedNoteId(id);
  };

  const selectGroup = (gid: string | null | undefined) => {
    setSelectedGroupId(gid);
    saveSelectedGroupId(gid);
  };
  
  const toggleSidebar = () => {
    const newVisible = !sidebarVisible();
    setSidebarVisible(newVisible);
    saveSidebarVisible(newVisible);
  };

  const createNewNote = (type: NoteType = 'normal') => {
    const newNote: Note = {
      id: `${Date.now()}`,
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type,
      isFavorite: false,
      pinned: false,
      groupId: selectedGroupId() ?? undefined,
    };
    
    batch(() => {
        setNotes([newNote, ...notes()]);
        selectNote(newNote.id);
    });

    saveToStorage([newNote, ...notes()]);
    // ... (database logic for Dexie)
  };
  
  const updateNote = (id: string, updates: Partial<Note>) => {
    const updatedNotes = notes().map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: Date.now() }
        : note
    );
    setNotes(updatedNotes);
    saveToStorage(updatedNotes);
    // ... (database logic for Dexie)
  };

  const deleteNote = (id: string) => {
    const updatedNotes = notes().filter(note => note.id !== id);
    setNotes(updatedNotes);
    if (selectedNoteId() === id) {
      selectNote(null);
    }
    saveToStorage(updatedNotes);
    // ... (database logic for Dexie)
  };

  const createNewGroup = (name: string = 'New Folder') => {
    const newGroup: Group = {
      id: `${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedGroups = [newGroup, ...groups()];
    setGroups(updatedGroups);
    saveGroupsToStorage(updatedGroups);
    setEditingGroupId(newGroup.id);
  };
  
  const updateGroup = (id: string, name: string) => {
    const updated = groups().map(group => 
      group.id === id 
        ? { ...group, name: name.trim() || 'New Folder', updatedAt: Date.now() }
        : group
    );
    setGroups(updated);
    saveGroupsToStorage(updated);
    setEditingGroupId(null);
  };
  
  const deleteGroup = (id: string) => {
    batch(() => {
      const updatedNotes = notes().map(note => 
        note.groupId === id 
          ? { ...note, groupId: undefined, updatedAt: Date.now() }
          : note
      );
      setNotes(updatedNotes);
      saveToStorage(updatedNotes);

      const updatedGroups = groups().filter(group => group.id !== id);
      setGroups(updatedGroups);
      saveGroupsToStorage(updatedGroups);

      if (selectedGroupId() === id) {
        selectGroup(null);
      }
    });
  };

  // Drag and Drop Handlers
  const handleGroupDragStart = (e: DragEvent, groupId: string) => {
    setDraggedGroupId(groupId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', groupId);
    }
  };
  const handleGroupDragOver = (e: DragEvent, groupId: string) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const elementHeight = rect.height;
    const currentIndex = groups().findIndex(g => g.id === groupId);
    if (currentIndex === -1) return;
    const nextInsertIndex = relativeY < elementHeight / 2 ? currentIndex : currentIndex + 1;
    setInsertIndex(nextInsertIndex);
  };
  const handleGroupDragLeave = () => {
    // keep highlight a bit for better UX; no-op
  };
  const handleGroupDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggedGroupId();
    const targetIndex = insertIndex();
    if (!draggedId || targetIndex === null) {
      setDraggedGroupId(null);
      setInsertIndex(null);
      return;
    }
    const current = groups();
    const fromIndex = current.findIndex(g => g.id === draggedId);
    if (fromIndex === -1) {
      setDraggedGroupId(null);
      setInsertIndex(null);
      return;
    }
    let toIndex = targetIndex;
    if (fromIndex < targetIndex) toIndex = targetIndex - 1;
    const newGroups = [...current];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    setGroups(newGroups);
    saveGroupsToStorage(newGroups);
    setDraggedGroupId(null);
    setInsertIndex(null);
  };
  const handleGroupDragEnd = () => {
    setDraggedGroupId(null);
    setInsertIndex(null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const handleMouseMove = (ev: MouseEvent) => {
      if (isResizing()) {
        const newWidth = Math.max(210, Math.min(600, ev.clientX));
        setSidebarWidth(newWidth);
        saveSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleContextMenu = (e: MouseEvent, noteId: string) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId });
  };
  
  const updateLeftSortDropdownPosition = (btnEl: HTMLButtonElement, headerEl: HTMLDivElement) => {
    if (!btnEl) return;
    const buttonRect = btnEl.getBoundingClientRect();
    const menuWidth = 224;
    const viewportPadding = 8;
    const verticalGap = 4;
    const containerRect = (headerEl || btnEl).getBoundingClientRect();
    let left = sidebarWidth() < 260 ? (containerRect.left + viewportPadding) : (buttonRect.right - menuWidth);
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuWidth - viewportPadding));
    const top = buttonRect.bottom + verticalGap;
    setLeftSortDropdownPos({ left, top });
  };

  // Supabase Auth functions
  const signUpWithEmail = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase!.auth.signUp({ email, password });
      if (error) throw error;
      console.log('Sign up data:', data);
      if (data.user && !data.session) {
        // User created but needs email confirmation
        alert('Please check your email to confirm your account!');
      } else if (data.session) {
        // User directly signed in (e.g., email confirmation not required on Supabase)
        alert('Signed up and logged in successfully!');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setAuthError(err.message || 'Failed to sign up.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    setIsMfaRequired(false); // Reset MFA state on new sign-in attempt
    try {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes('mfa_required')) {
          setIsMfaRequired(true);
          setAuthError('MFA required. Please enter your 2FA code.');
        } else {
          throw error;
        }
      } else {
        console.log('Signed in data:', data);
        // Session listener will pick up the session if successful
        setIsMfaRequired(false);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(err.message || 'Failed to sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyMfaChallenge = async (code: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error: factorsError } = await supabase!.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = data?.totp?.find((f: any) => f.status === 'verified');

      if (!totpFactor) {
        throw new Error('No active TOTP factor found for MFA verification.');
      }

      const { data: challengeData, error: challengeError } = await supabase!.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      const challengeId = challengeData.id;

      const { error: verifyError } = await supabase!.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId,
        code,
      });

      if (verifyError) throw verifyError;

      console.log('MFA Verified successfully!');
      setIsMfaRequired(false); // Reset MFA state
      setAuthError(null); // Clear any MFA error
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setAuthError(err.message || 'Failed to verify MFA code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, // Redirect back to the app after OAuth
        },
      });
      if (error) throw error;
      console.log('Google sign-in initiated:', data);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setAuthError(err.message || 'Failed to sign in with Google.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
      console.log('Signed out successfully.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setAuthError(err.message || 'Failed to sign out.');
    } finally {
      setAuthLoading(false);
    }
  };

  const startMfaSetup = async () => {
      setAuthLoading(true);
      setAuthError(null);
      setMfaEnrollmentData(null); // Clear previous data
      try {
          const { data, error } = await supabase!.auth.mfa.enroll({
              factorType: 'totp',
          });
          if (error) throw error;

          const { qr_code, secret } = data.totp;
          setMfaEnrollmentData({ secret, qrCode: qr_code, factorId: data.id });
          console.log('MFA enrollment started:', data);
          setAuthError(null); // Clear any previous error
      } catch (err: any) {
          console.error('Start MFA setup error:', err);
          setAuthError(err.message || 'Failed to start MFA setup.');
      } finally {
          setAuthLoading(false);
      }
  };

  const verifyMfaSetup = async (code: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (!mfaEnrollmentData()) {
        throw new Error('MFA enrollment not initiated.');
      }

      const { error } = await supabase!.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollmentData()!.factorId,
        code,
      });

      if (error) throw error;

      alert('MFA setup verified successfully!');
      setMfaEnrollmentData(null); // Clear setup data after successful verification
      setAuthError(null); // Clear any previous error
    } catch (err: any) {
      console.error('Verify MFA setup error:', err);
      setAuthError(err.message || 'Failed to verify MFA setup.');
    } finally {
      setAuthLoading(false);
    }
  };

  const disableMfa = async (factorId: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
          const { error } = await supabase!.auth.mfa.unenroll({ factorId });
          if (error) throw error;
          alert('MFA disabled successfully!');
          setAuthError(null); // Clear any previous error
      } catch (err: any) {
          console.error('Disable MFA error:', err);
          setAuthError(err.message || 'Failed to disable MFA.');
      } finally {
          setAuthLoading(false);
      }
  };


  onMount(() => {
    setNotes(loadFromStorage());
    setGroups(loadGroupsFromStorage());
    setSidebarWidth(loadSidebarWidth());
    setSidebarVisible(loadSidebarVisible());

    // Supabase Auth Listener
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user || null);
        setAuthLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', event, session);
          batch(() => {
            setSession(session);
            setUser(session?.user || null);
            setAuthLoading(false);
            setAuthError(null); // Clear errors on state change
            setIsMfaRequired(false); // Reset MFA required state on any auth state change
            if (event === 'SIGNED_OUT') {
                setMfaEnrollmentData(null); // Clear MFA setup data
            }
          });
        }
      );
      onCleanup(() => {
        subscription.unsubscribe();
      });
    } else {
      setAuthLoading(false);
      setAuthError('Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const restoredGroup = loadSelectedGroupId();
    setSelectedGroupId(restoredGroup);
    const restoredNote = loadSelectedNoteId();
    if (restoredNote && notes().some(n => n.id === restoredNote)) {
      setSelectedNoteId(restoredNote);
    } else if (notes().length > 0) {
      setSelectedNoteId(notes()[0].id);
    }
    selectionRestored = true;
    
    // ... (sync logic) ...
  });

  createEffect(() => {
    if (selectionRestored) saveSelectedNoteId(selectedNoteId());
  });
  createEffect(() => {
    if (selectionRestored) saveSelectedGroupId(selectedGroupId());
  });

  // --- RETURN PUBLIC API ---
  return {
    // State (Accessors)
    notes,
    groups,
    selectedNoteId,
    selectedGroupId,
    sidebarWidth,
    isResizing,
    sidebarVisible,
    dropdownOpen,
    contextMenu,
    editorContextMenu,
    filterType,
    filtersVisible,
    editingGroupId,
    draggedGroupId,
    insertIndex,
    isMainModalOpen,
    activeModalTab,
    isSearchModalOpen,
    searchModalQuery,
    searchQuery: searchModalQuery,
    leftListFilter,
    leftListDropdownOpen,
    leftListSortOpen,
    leftListSortKey,
    leftListSortOrder,
    leftListPinnedFirst,
    leftSortDropdownPos,
    spellcheckDisabled,

    // Supabase Auth State
    session,
    user,
    authLoading,
    authError,
    isMfaRequired,
    mfaEnrollmentData,

    // Setters
    setNotes,
    setGroups,
    setSelectedNoteId,
    setSelectedGroupId,
    setSidebarWidth,
    setIsResizing,
    setSidebarVisible,
    setDropdownOpen,
    setContextMenu,
    setEditorContextMenu,
    setFilterType,
    setFiltersVisible,
    setEditingGroupId,
    setDraggedGroupId,
    setInsertIndex,
    setIsMainModalOpen,
    setActiveModalTab,
    setIsSearchModalOpen,
    setSearchModalQuery,
    setLeftListFilter,
    setLeftListDropdownOpen,
    setLeftListSortOpen,
    setLeftListSortKey,
    setLeftListSortOrder,
    setLeftListPinnedFirst,
    setLeftSortDropdownPos,
    setSpellcheckDisabled,
    // (No direct setters for auth states like setSession, setUser as they are handled internally or by Supabase listener)

    // Derived State (Memos)
    selectedNote,
    noteStats,
    sortedNotes,
    searchModalResults,

    // Actions (Functions)
    toggleSidebar,
    selectNote,
    selectGroup,
    createNewNote,
    updateNote,
    deleteNote,
    createNewGroup,
    updateGroup,
    deleteGroup,
    handleGroupDragStart,
    handleGroupDragOver,
    handleGroupDragLeave,
    handleGroupDrop,
    handleGroupDragEnd,
    handleMouseDown,
    handleContextMenu,
    updateLeftSortDropdownPosition,

    // Supabase Auth Actions
    signUpWithEmail,
    signInWithEmail,
    verifyMfaChallenge,
    signInWithGoogle,
    signOut,
    startMfaSetup,
    verifyMfaSetup,
    disableMfa,
  };
}
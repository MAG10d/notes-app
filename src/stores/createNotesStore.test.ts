// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';
import { createNotesStore } from './createNotesStore';
import * as syncModule from '../sync';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      mfa: {
        enroll: vi.fn(),
        challengeAndVerify: vi.fn(),
        unenroll: vi.fn(),
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
      }
    }
  }
}));

// Mock Sync
vi.mock('../sync', () => ({
  runSyncOnce: vi.fn(),
  subscribeRealtime: vi.fn().mockReturnValue(() => {}),
}));

// Mock Storage
vi.mock('../services/storage.ts', () => ({
  loadFromStorage: vi.fn().mockReturnValue([]),
  saveToStorage: vi.fn(),
  loadGroupsFromStorage: vi.fn().mockReturnValue([]),
  saveGroupsToStorage: vi.fn(),
  loadSelectedNoteId: vi.fn().mockReturnValue(null),
  saveSelectedNoteId: vi.fn(),
  loadSelectedGroupId: vi.fn().mockReturnValue(undefined),
  saveSelectedGroupId: vi.fn(),
  loadSidebarWidth: vi.fn().mockReturnValue(320),
  saveSidebarWidth: vi.fn(),
  loadSidebarVisible: vi.fn().mockReturnValue(true),
  saveSidebarVisible: vi.fn(),
  loadSpellcheckDisabled: vi.fn().mockReturnValue(false),
  loadTheme: vi.fn().mockReturnValue('light'),
  saveTheme: vi.fn(),
  loadLanguage: vi.fn().mockReturnValue('en'),
  saveLanguage: vi.fn(),
}));

describe('createNotesStore - Sync Integration', () => {
  let mockOnAuthStateChange: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    (supabase as any).auth.onAuthStateChange = mockOnAuthStateChange;
  });

  it('should call runSyncOnce when user signs in', async () => {
    let capturedCallback: any;
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        createNotesStore();

        // Allow onMount to run
        setTimeout(() => {
          if (capturedCallback) {
            capturedCallback('SIGNED_IN', { user: { id: '123' } });
            try {
              expect(syncModule.runSyncOnce).toHaveBeenCalled();
              resolve();
            } catch (e) {
               // Ignore
            }
          }
          dispose();
        }, 10);
      });
    });

    expect(syncModule.runSyncOnce).toHaveBeenCalled();
  });
});

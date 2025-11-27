export async function runSyncOnce(): Promise<void> {
  console.log('Synchronizing data...');
  // No-op: implement push/pull sync later
}

export function subscribeRealtime(): () => void {
  // No-op: implement Supabase Realtime subscription later
  return () => {}
}

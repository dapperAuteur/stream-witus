// Offline-aware fetch wrapper — same signature as the CentOS original so the
// ported components import it unchanged. The full IndexedDB cache + mutation
// queue (CentOS's sync-manager) is deferred to a later phase; for now this is a
// thin pass-through to `fetch`, which is correct online behaviour. Swapping in a
// real offline layer later is a drop-in replacement behind this same export.
export async function offlineFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

import { isTauri, invoke } from '@tauri-apps/api/core';
import { STORAGE_KEY } from './model.ts';
export const desktop = isTauri();
export async function loadWorkspace(): Promise<{
  raw: string | null;
  migrated: boolean;
  legacy_error: boolean;
}> {
  if (desktop) return invoke('load_workspace');
  return { raw: localStorage.getItem(STORAGE_KEY), migrated: false, legacy_error: false };
}
export async function saveWorkspace(content: string, expected: string | null) {
  if (desktop) return invoke<void>('save_workspace', { content, expected });
  if (localStorage.getItem(STORAGE_KEY) !== expected) throw Error('conflict');
  localStorage.setItem(STORAGE_KEY, content);
}
export async function exportNative(content: string, filename: string) {
  return invoke<boolean>('export_file', { content, filename });
}
export async function importNative() {
  return invoke<string | null>('import_file');
}
export async function openNative(url: string) {
  return invoke<void>('open_link', { url });
}

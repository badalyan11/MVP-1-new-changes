import type { AuthUser, Journal, JournalSummary, Page, Photo, PhotoUrls } from "../../types";
import type { Store } from "./types";
import { uid } from "../ids";

/**
 * Local-only backend, used when Supabase isn't configured. Everything lives in
 * this browser (JSON in localStorage, image files in IndexedDB). There are no
 * accounts and no sharing in this mode.
 */
const LOCAL_USER: AuthUser = { id: "local-user", email: "", name: "You" };

const KEY_JOURNALS = "lj2:journals";
const KEY_INTERESTS = "lj2:book-interests";
const keyPages = (id: string) => `lj2:pages:${id}`;
const keyPhotos = (id: string) => `lj2:photos:${id}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- IndexedDB blob storage ----------
const DB_NAME = "lj2-blobs";
const BLOB_STORE = "blobs";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(BLOB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(BLOB_STORE, "readonly").objectStore(BLOB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const urlCache = new Map<string, string>();

async function blobUrl(photoId: string, size: "thumb" | "display"): Promise<string | undefined> {
  const key = `${photoId}:${size}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await getBlob(key);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

const noAccounts = () => Promise.reject(new Error("Accounts aren't available in local mode."));
const noSharing = () => Promise.reject(new Error("Sharing needs an account. Connect the app to Supabase to turn it on."));

export const localStore: Store = {
  kind: "local",

  getUser: async () => LOCAL_USER,
  onAuthChange: () => () => {},
  signUp: noAccounts,
  signIn: noAccounts,
  signOut: async () => {},
  sendPasswordReset: noAccounts,
  updatePassword: noAccounts,
  getAccessToken: async () => null,

  async listJournals() {
    const journals = read<Journal[]>(KEY_JOURNALS, []);
    const out: JournalSummary[] = [];
    for (const j of journals) {
      const pages = read<Page[]>(keyPages(j.id), []);
      const photos = read<Photo[]>(keyPhotos(j.id), []);
      const coverUrl = j.design.coverPhotoId ? (await blobUrl(j.design.coverPhotoId, "thumb")) ?? null : null;
      out.push({ ...j, role: "owner", pageCount: pages.length, photoCount: photos.length, coverUrl });
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getJournal(id) {
    const journal = read<Journal[]>(KEY_JOURNALS, []).find((j) => j.id === id);
    return journal ? { journal, role: "owner" } : null;
  },

  async createJournal(journal, firstPage) {
    write(KEY_JOURNALS, [...read<Journal[]>(KEY_JOURNALS, []), journal]);
    write(keyPages(journal.id), [firstPage]);
    write(keyPhotos(journal.id), []);
  },

  async updateJournal(id, patch) {
    const journals = read<Journal[]>(KEY_JOURNALS, []).map((j) =>
      j.id === id ? { ...j, ...patch, updatedAt: new Date().toISOString() } : j
    );
    write(KEY_JOURNALS, journals);
  },

  async deleteJournal(id) {
    const photos = read<Photo[]>(keyPhotos(id), []);
    for (const p of photos) {
      for (const size of ["original", "display", "thumb"]) await deleteBlob(`${p.id}:${size}`);
    }
    write(KEY_JOURNALS, read<Journal[]>(KEY_JOURNALS, []).filter((j) => j.id !== id));
    localStorage.removeItem(keyPages(id));
    localStorage.removeItem(keyPhotos(id));
  },

  async listPages(journalId) {
    return read<Page[]>(keyPages(journalId), []).sort(
      (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
    );
  },

  async savePages(journalId, upserts, deleteIds) {
    const byId = new Map(read<Page[]>(keyPages(journalId), []).map((p) => [p.id, p]));
    for (const id of deleteIds) byId.delete(id);
    const now = new Date().toISOString();
    for (const p of upserts) byId.set(p.id, { ...p, updatedAt: now });
    write(keyPages(journalId), [...byId.values()]);
    write(
      KEY_JOURNALS,
      read<Journal[]>(KEY_JOURNALS, []).map((j) => (j.id === journalId ? { ...j, updatedAt: now } : j))
    );
  },

  async listPhotos(journalId) {
    return read<Photo[]>(keyPhotos(journalId), []);
  },

  async uploadPhoto(journalId, file, processed) {
    const id = uid();
    await putBlob(`${id}:original`, file);
    await putBlob(`${id}:display`, processed.display);
    await putBlob(`${id}:thumb`, processed.thumb);
    const photo: Photo = {
      id,
      journalId,
      uploadedBy: LOCAL_USER.id,
      uploaderName: LOCAL_USER.name,
      filename: file.name,
      width: processed.width,
      height: processed.height,
      sizeBytes: file.size,
      takenAt: processed.takenAt,
      createdAt: new Date().toISOString(),
    };
    write(keyPhotos(journalId), [...read<Photo[]>(keyPhotos(journalId), []), photo]);
    const urls: PhotoUrls = {
      thumb: (await blobUrl(id, "thumb")) ?? undefined,
      display: (await blobUrl(id, "display")) ?? undefined,
    };
    return { photo, urls };
  },

  async deletePhoto(photo) {
    for (const size of ["original", "display", "thumb"]) await deleteBlob(`${photo.id}:${size}`);
    urlCache.delete(`${photo.id}:thumb`);
    urlCache.delete(`${photo.id}:display`);
    write(keyPhotos(photo.journalId), read<Photo[]>(keyPhotos(photo.journalId), []).filter((p) => p.id !== photo.id));
  },

  async getPhotoUrls(photos, sizes) {
    const out: Record<string, PhotoUrls> = {};
    for (const p of photos) {
      const entry: PhotoUrls = {};
      for (const size of sizes) entry[size] = (await blobUrl(p.id, size)) ?? undefined;
      out[p.id] = entry;
    }
    return out;
  },

  async listMembers() {
    return [
      { userId: LOCAL_USER.id, role: "owner", displayName: LOCAL_USER.name, email: "", joinedAt: new Date().toISOString() },
    ];
  },
  removeMember: noSharing,
  createInvite: noSharing,
  listInvites: async () => [],
  revokeInvite: noSharing,
  getInviteInfo: async () => null,
  acceptInvite: noSharing,

  async hasBookInterest(journalId) {
    return read<string[]>(KEY_INTERESTS, []).includes(journalId);
  },
  async markBookInterest(journalId) {
    const list = read<string[]>(KEY_INTERESTS, []);
    if (!list.includes(journalId)) write(KEY_INTERESTS, [...list, journalId]);
  },
};

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Journal, Page, Photo, PhotoElement, PhotoUrls, Role } from "../types";
import { store } from "../lib/store";
import { useAuth } from "./AuthContext";
import { processImage } from "../lib/imageProcessing";
import { sortPages } from "../lib/pageOps";

export type SaveState = "saved" | "saving" | "error";

export interface UploadProgress {
  total: number;
  done: number;
  errors: string[];
}

interface AlbumValue {
  loading: boolean;
  error: string | null;
  journal: Journal;
  role: Role;
  isOwner: boolean;
  userId: string;
  userName: string;

  pages: Page[];
  photos: Photo[];
  photoById: (id: string) => Photo | undefined;
  /** Display name of an album member, if known. */
  memberName: (userId: string) => string | undefined;
  photoUrls: Record<string, PhotoUrls>;
  usedPhotoIds: Set<string>;
  ensureUrls: (photoIds: string[], size: "thumb" | "display") => void;

  canEditPage: (page: Page) => boolean;
  commitPages: (next: Page[] | ((prev: Page[]) => Page[]), opts?: { coalesce?: string }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  saveError: string | null;
  retrySave: () => void;

  uploadPhotos: (files: File[]) => Promise<Photo[]>;
  uploadProgress: UploadProgress | null;
  deletePhoto: (photoId: string) => Promise<void>;

  updateJournal: (patch: Partial<Pick<Journal, "title" | "subject" | "dateLabel" | "design" | "customTypeDescription">>) => Promise<void>;
  setCover: (photoId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

const AlbumContext = createContext<AlbumValue | null>(null);

const HISTORY_LIMIT = 60;
const SAVE_DELAY_MS = 700;

const signature = (p: Page) => JSON.stringify([p.position, p.span, p.style, p.autoLayout, p.layoutId, p.elements, p.meta]);

export function AlbumProvider({ journalId, children }: { journalId: string; children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "local-user";
  const userName = user?.name ?? "You";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [role, setRole] = useState<Role>("owner");
  const [pages, setPages] = useState<Page[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, PhotoUrls>>({});
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const pagesRef = useRef<Page[]>([]);
  const roleRef = useRef<Role>("owner");
  const history = useRef<{ past: Page[][]; future: Page[][] }>({ past: [], future: [] });
  const savedSigs = useRef<Map<string, string>>(new Map());
  const saveTimer = useRef<number | null>(null);
  const saving = useRef(false);
  const dirtyWhileSaving = useRef(false);
  const requestedUrls = useRef<Set<string>>(new Set());
  const lastCoalesce = useRef<{ key: string; at: number } | null>(null);

  const isOwner = role === "owner";

  const canEditPage = useCallback((page: Page) => roleRef.current === "owner" || page.createdBy === userId, [userId]);

  // ---------- loading ----------
  const load = useCallback(async () => {
    setError(null);
    try {
      const found = await store.getJournal(journalId);
      if (!found) {
        setError("We couldn't find that album. It may have been deleted, or you may not have access.");
        setLoading(false);
        return;
      }
      const [loadedPages, loadedPhotos] = await Promise.all([store.listPages(journalId), store.listPhotos(journalId)]);
      const sorted = sortPages(loadedPages);
      roleRef.current = found.role;
      pagesRef.current = sorted;
      savedSigs.current = new Map(sorted.map((p) => [p.id, signature(p)]));
      history.current = { past: [], future: [] };
      requestedUrls.current = new Set();
      setRole(found.role);
      setJournal(found.journal);
      setPages(sorted);
      setPhotos(loadedPhotos);
      setHistoryVersion((v) => v + 1);
      store
        .listMembers(journalId)
        .then((members) => setMemberNames(Object.fromEntries(members.map((m) => [m.userId, m.displayName]))))
        .catch(() => undefined);

      const used = new Set<string>();
      for (const p of sorted) for (const e of p.elements) if (e.type === "photo") used.add(e.photoId);
      if (found.journal.design.coverPhotoId) used.add(found.journal.design.coverPhotoId);

      const [thumbs, displays] = await Promise.all([
        store.getPhotoUrls(loadedPhotos, ["thumb"]),
        store.getPhotoUrls(loadedPhotos.filter((p) => used.has(p.id)), ["display"]),
      ]);
      for (const p of loadedPhotos) {
        requestedUrls.current.add(`${p.id}:thumb`);
        if (used.has(p.id)) requestedUrls.current.add(`${p.id}:display`);
      }
      setPhotoUrls(() => {
        const merged: Record<string, PhotoUrls> = {};
        for (const p of loadedPhotos) merged[p.id] = { ...thumbs[p.id], ...displays[p.id] };
        return merged;
      });
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this album.");
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // ---------- saving ----------
  const flushSave = useCallback(async () => {
    if (saving.current) {
      dirtyWhileSaving.current = true;
      return;
    }
    const current = pagesRef.current;
    const currentIds = new Set(current.map((p) => p.id));
    const upserts = current.filter((p) => canEditPage(p) && savedSigs.current.get(p.id) !== signature(p));
    const deleteIds = [...savedSigs.current.keys()].filter((id) => !currentIds.has(id));
    if (upserts.length === 0 && deleteIds.length === 0) {
      setSaveState("saved");
      return;
    }
    saving.current = true;
    dirtyWhileSaving.current = false;
    setSaveState("saving");
    try {
      await store.savePages(journalId, upserts, deleteIds);
      for (const p of upserts) savedSigs.current.set(p.id, signature(p));
      for (const id of deleteIds) savedSigs.current.delete(id);
      setSaveError(null);
      saving.current = false;
      if (dirtyWhileSaving.current) await flushSave();
      else setSaveState("saved");
    } catch (e) {
      saving.current = false;
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Couldn't save your changes.");
    }
  }, [journalId, canEditPage]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void flushSave();
    }, SAVE_DELAY_MS);
  }, [flushSave]);

  // Save anything pending when leaving the album, and warn before closing the tab mid-save.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveTimer.current || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void flushSave();
      }
    };
  }, [flushSave]);

  // Pick up what other members added while this tab was in the background.
  const syncRemote = useCallback(async () => {
    if (store.kind !== "cloud" || saving.current || saveTimer.current) return;
    try {
      const [remotePages, remotePhotos] = await Promise.all([store.listPages(journalId), store.listPhotos(journalId)]);
      if (saving.current || saveTimer.current) return; // the person started editing meanwhile
      const sorted = sortPages(remotePages);
      const fingerprint = (list: Page[]) => JSON.stringify(list.map((p) => [p.id, signature(p)]));
      if (fingerprint(sorted) !== fingerprint(pagesRef.current)) {
        pagesRef.current = sorted;
        savedSigs.current = new Map(sorted.map((p) => [p.id, signature(p)]));
        history.current = { past: [], future: [] };
        setPages(sorted);
        setHistoryVersion((v) => v + 1);
      }
      setPhotos((cur) => (cur.length === remotePhotos.length && cur.every((p, i) => p.id === remotePhotos[i].id) ? cur : remotePhotos));
      const fresh = remotePhotos.filter((p) => !requestedUrls.current.has(`${p.id}:thumb`));
      if (fresh.length) {
        for (const p of fresh) requestedUrls.current.add(`${p.id}:thumb`);
        const urls = await store.getPhotoUrls(fresh, ["thumb"]);
        setPhotoUrls((cur) => {
          const merged = { ...cur };
          for (const [id, u] of Object.entries(urls)) merged[id] = { ...merged[id], ...u };
          return merged;
        });
      }
    } catch {
      /* a failed background refresh is harmless */
    }
  }, [journalId]);

  useEffect(() => {
    if (store.kind !== "cloud") return;
    let last = Date.now();
    const onReturn = () => {
      if (document.visibilityState === "hidden" || Date.now() - last < 15000) return;
      last = Date.now();
      void syncRemote();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [syncRemote]);

  // ---------- pages + history ----------
  const applyPages = useCallback(
    (next: Page[]) => {
      pagesRef.current = next;
      setPages(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const commitPages = useCallback(
    (updater: Page[] | ((prev: Page[]) => Page[]), opts?: { coalesce?: string }) => {
      const prev = pagesRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      // Repeated small edits of the same kind (typing, zooming) count as one undo step.
      const now = Date.now();
      const last = lastCoalesce.current;
      const coalesced = Boolean(opts?.coalesce && last && last.key === opts.coalesce && now - last.at < 1500);
      lastCoalesce.current = opts?.coalesce ? { key: opts.coalesce, at: now } : null;
      if (!coalesced) {
        history.current.past.push(prev);
        if (history.current.past.length > HISTORY_LIMIT) history.current.past.shift();
        history.current.future = [];
        setHistoryVersion((v) => v + 1);
      }
      applyPages(next);
    },
    [applyPages]
  );

  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(pagesRef.current);
    setHistoryVersion((v) => v + 1);
    applyPages(prev);
  }, [applyPages]);

  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(pagesRef.current);
    setHistoryVersion((v) => v + 1);
    applyPages(next);
  }, [applyPages]);

  // ---------- photos ----------
  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const photoById = useCallback((id: string) => photoMap.get(id), [photoMap]);
  const memberName = useCallback((id: string) => memberNames[id], [memberNames]);

  const usedPhotoIds = useMemo(() => {
    const used = new Set<string>();
    for (const p of pages) for (const e of p.elements) if (e.type === "photo") used.add((e as PhotoElement).photoId);
    return used;
  }, [pages]);

  const ensureUrls = useCallback(
    (photoIds: string[], size: "thumb" | "display") => {
      const missing = photoIds.filter((id) => !requestedUrls.current.has(`${id}:${size}`));
      if (missing.length === 0) return;
      const targets = missing.map((id) => photoMap.get(id)).filter(Boolean) as Photo[];
      if (targets.length === 0) return;
      for (const id of missing) requestedUrls.current.add(`${id}:${size}`);
      store
        .getPhotoUrls(targets, [size])
        .then((urls) => setPhotoUrls((cur) => {
          const merged = { ...cur };
          for (const [id, u] of Object.entries(urls)) merged[id] = { ...merged[id], ...u };
          return merged;
        }))
        .catch(() => {
          for (const id of missing) requestedUrls.current.delete(`${id}:${size}`);
        });
    },
    [photoMap]
  );

  const uploadPhotos = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
      if (images.length === 0) return [];
      const progress: UploadProgress = { total: images.length, done: 0, errors: [] };
      setUploadProgress({ ...progress });
      const added: Photo[] = [];
      let cursor = 0;

      const worker = async () => {
        while (cursor < images.length) {
          const file = images[cursor++];
          try {
            const processed = await processImage(file);
            const { photo, urls } = await store.uploadPhoto(journalId, file, processed);
            requestedUrls.current.add(`${photo.id}:thumb`);
            requestedUrls.current.add(`${photo.id}:display`);
            added.push(photo);
            setPhotos((cur) => [...cur, photo]);
            setPhotoUrls((cur) => ({ ...cur, [photo.id]: urls }));
          } catch (e) {
            progress.errors.push(e instanceof Error ? e.message : `${file.name} couldn't be uploaded.`);
          }
          progress.done += 1;
          setUploadProgress({ ...progress, errors: [...progress.errors] });
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, images.length) }, worker));
      window.setTimeout(() => setUploadProgress((cur) => (cur && cur.done >= cur.total && cur.errors.length === 0 ? null : cur)), 1500);
      return added;
    },
    [journalId]
  );

  // ---------- album settings ----------
  const updateJournal = useCallback(
    async (patch: Partial<Pick<Journal, "title" | "subject" | "dateLabel" | "design" | "customTypeDescription">>) => {
      await store.updateJournal(journalId, patch);
      setJournal((cur) => (cur ? { ...cur, ...patch, updatedAt: new Date().toISOString() } : cur));
    },
    [journalId]
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      const photo = photoMap.get(photoId);
      if (!photo) return;
      const onPages = pagesRef.current.filter((p) => p.elements.some((e) => e.type === "photo" && e.photoId === photoId));
      if (onPages.length > 0 && roleRef.current !== "owner") {
        throw new Error("This photo is on a page. Ask the album owner to take it off first.");
      }
      if (onPages.length > 0) {
        const cleaned = pagesRef.current.map((p) =>
          onPages.includes(p) ? { ...p, elements: p.elements.filter((e) => !(e.type === "photo" && e.photoId === photoId)) } : p
        );
        history.current = { past: [], future: [] };
        setHistoryVersion((v) => v + 1);
        applyPages(cleaned);
      }
      await store.deletePhoto(photo);
      setPhotos((cur) => cur.filter((p) => p.id !== photoId));
      if (journal && journal.design.coverPhotoId === photoId) {
        await updateJournal({ design: { ...journal.design, coverPhotoId: null } });
      }
    },
    [photoMap, applyPages, journal, updateJournal]
  );

  const setCover = useCallback(
    async (photoId: string | null) => {
      if (!journal) return;
      if (photoId) ensureUrls([photoId], "display");
      await updateJournal({ design: { ...journal.design, coverPhotoId: photoId } });
    },
    [journal, updateJournal, ensureUrls]
  );

  const value = useMemo<AlbumValue | null>(() => {
    if (!journal) return null;
    return {
      loading,
      error,
      journal,
      role,
      isOwner,
      userId,
      userName,
      pages,
      photos,
      photoById,
      memberName,
      photoUrls,
      usedPhotoIds,
      ensureUrls,
      canEditPage,
      commitPages,
      undo,
      redo,
      canUndo: history.current.past.length > 0,
      canRedo: history.current.future.length > 0,
      saveState,
      saveError,
      retrySave: () => void flushSave(),
      uploadPhotos,
      uploadProgress,
      deletePhoto,
      updateJournal,
      setCover,
      refresh: load,
    };
    // historyVersion is read so canUndo/canRedo stay fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal, loading, error, role, isOwner, userId, userName, pages, photos, photoById, memberName, photoUrls, usedPhotoIds, ensureUrls, canEditPage, commitPages, undo, redo, historyVersion, saveState, saveError, flushSave, uploadPhotos, uploadProgress, deletePhoto, updateJournal, setCover, load]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="font-serif text-xl text-ink">{error}</p>
        <a href="/" className="mt-4 text-sm text-ink/60 underline hover:text-ink">
          Back to my journals
        </a>
      </div>
    );
  }
  if (loading || !value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-sm text-ink/50">Opening your album...</div>
    );
  }
  return <AlbumContext.Provider value={value}>{children}</AlbumContext.Provider>;
}

export function useAlbum(): AlbumValue {
  const ctx = useContext(AlbumContext);
  if (!ctx) throw new Error("useAlbum must be used within AlbumProvider");
  return ctx;
}

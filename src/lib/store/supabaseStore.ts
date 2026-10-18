import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type {
  AuthUser,
  Invite,
  InviteInfo,
  Journal,
  JournalDesign,
  JournalSummary,
  Member,
  Page,
  Photo,
  PhotoUrls,
  Role,
} from "../../types";
import type { AuthEvent, Store } from "./types";
import { supabase } from "../supabaseClient";
import { normalizePageStyle } from "../pageStyles";
import { uid } from "../ids";

const BUCKET = "album-photos";
const SIGNED_URL_SECONDS = 60 * 60 * 8;

/* eslint-disable @typescript-eslint/no-explicit-any */

function client(): SupabaseClient {
  if (!supabase) throw new Error("Supabase isn't configured.");
  return supabase;
}

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function toUser(u: User): AuthUser {
  const email = u.email ?? "";
  const name = (u.user_metadata?.name as string | undefined) || email.split("@")[0] || "You";
  return { id: u.id, email, name };
}

function normalizeDesign(d: any): JournalDesign {
  return {
    presetId: d?.presetId ?? "custom",
    coverColor: d?.coverColor ?? "#EDE8DE",
    coverPhotoId: d?.coverPhotoId ?? null,
    ...(typeof d?.coverFocusX === "number" ? { coverFocusX: d.coverFocusX } : {}),
    ...(typeof d?.coverFocusY === "number" ? { coverFocusY: d.coverFocusY } : {}),
    titleFont: d?.titleFont ?? "lora",
    pageStyle: normalizePageStyle(d?.pageStyle),
    accentColor: d?.accentColor ?? "#2F2F2F",
  };
}

function toJournal(r: any): Journal {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    mode: r.mode,
    journalType: r.journal_type,
    customTypeDescription: r.custom_type_description ?? "",
    subject: r.subject ?? "",
    dateLabel: r.date_label ?? "",
    design: normalizeDesign(r.design),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toPage(r: any): Page {
  return {
    id: r.id,
    journalId: r.journal_id,
    position: Number(r.position),
    span: r.span === 2 ? 2 : 1,
    style: r.style ? normalizePageStyle(r.style) : null,
    autoLayout: Boolean(r.auto_layout),
    layoutId: r.layout_id ?? null,
    elements: Array.isArray(r.elements) ? r.elements : [],
    meta: r.meta ?? {},
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toPageRow(p: Page) {
  return {
    id: p.id,
    journal_id: p.journalId,
    position: p.position,
    span: p.span,
    style: p.style,
    auto_layout: p.autoLayout,
    layout_id: p.layoutId,
    elements: p.elements,
    meta: p.meta,
    created_by: p.createdBy,
  };
}

function toPhoto(r: any): Photo {
  return {
    id: r.id,
    journalId: r.journal_id,
    uploadedBy: r.uploaded_by,
    uploaderName: r.uploader?.display_name ?? "",
    filename: r.filename ?? "",
    width: r.width,
    height: r.height,
    sizeBytes: Number(r.size_bytes ?? 0),
    takenAt: r.taken_at ?? null,
    createdAt: r.created_at,
    originalPath: r.original_path,
  };
}

const displayPath = (p: Pick<Photo, "journalId" | "id">) => `${p.journalId}/${p.id}/display.jpg`;
const thumbPath = (p: Pick<Photo, "journalId" | "id">) => `${p.journalId}/${p.id}/thumb.jpg`;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const group of chunk(paths, 100)) {
    const { data, error } = await client().storage.from(BUCKET).createSignedUrls(group, SIGNED_URL_SECONDS);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
    }
  }
  return out;
}

async function currentUserId(): Promise<string> {
  const { data } = await client().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in again.");
  return id;
}

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const supabaseStore: Store = {
  kind: "cloud",

  // ---------- accounts ----------
  async getUser() {
    const { data } = await client().auth.getSession();
    return data.session ? toUser(data.session.user) : null;
  },

  onAuthChange(cb) {
    const { data } = client().auth.onAuthStateChange((event: string, session: Session | null) => {
      const user = session ? toUser(session.user) : null;
      if (event === "PASSWORD_RECOVERY") cb("PASSWORD_RECOVERY" as AuthEvent, user);
      else if (event === "SIGNED_OUT") cb("SIGNED_OUT", null);
      else if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        cb(user ? "SIGNED_IN" : "SIGNED_OUT", user);
      }
    });
    return () => data.subscription.unsubscribe();
  },

  async signUp(email, password, name) {
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  },

  async signIn(email, password) {
    const { error } = await client().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    const { error } = await client().auth.signOut();
    if (error) throw new Error(error.message);
  },

  async sendPasswordReset(email) {
    const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password) {
    const { error } = await client().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  async getAccessToken() {
    const { data } = await client().auth.getSession();
    return data.session?.access_token ?? null;
  },

  // ---------- albums ----------
  async listJournals() {
    const rows = must(await client().rpc("my_journals")) as any[];
    const journals = rows.map((r) => ({ ...toJournal(r), role: r.role as Role, pageCount: Number(r.page_count), photoCount: Number(r.photo_count) }));
    const coverPaths = journals
      .filter((j) => j.design.coverPhotoId)
      .map((j) => thumbPath({ journalId: j.id, id: j.design.coverPhotoId as string }));
    const urls = coverPaths.length ? await signedUrls(coverPaths).catch(() => ({} as Record<string, string>)) : {};
    return journals.map<JournalSummary>((j) => ({
      ...j,
      coverUrl: j.design.coverPhotoId ? urls[thumbPath({ journalId: j.id, id: j.design.coverPhotoId })] ?? null : null,
    }));
  },

  async getJournal(id) {
    const userId = await currentUserId();
    const { data, error } = await client().from("journals").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const member = must(await client().from("journal_members").select("role").eq("journal_id", id).eq("user_id", userId).maybeSingle());
    return { journal: toJournal(data), role: ((member as any)?.role ?? "collaborator") as Role };
  },

  async createJournal(journal, firstPage) {
    must(
      await client().from("journals").insert({
        id: journal.id,
        owner_id: journal.ownerId,
        title: journal.title,
        mode: journal.mode,
        journal_type: journal.journalType,
        custom_type_description: journal.customTypeDescription,
        subject: journal.subject,
        date_label: journal.dateLabel,
        design: journal.design,
      })
    );
    must(await client().from("pages").insert(toPageRow(firstPage)));
  },

  async updateJournal(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.subject !== undefined) row.subject = patch.subject;
    if (patch.dateLabel !== undefined) row.date_label = patch.dateLabel;
    if (patch.customTypeDescription !== undefined) row.custom_type_description = patch.customTypeDescription;
    if (patch.design !== undefined) row.design = patch.design;
    must(await client().from("journals").update(row).eq("id", id));
  },

  async deleteJournal(id) {
    const photos = must(await client().from("photos").select("id, journal_id, original_path").eq("journal_id", id)) as any[];
    const paths = photos.flatMap((p) => [p.original_path, displayPath({ journalId: id, id: p.id }), thumbPath({ journalId: id, id: p.id })]);
    for (const group of chunk(paths, 100)) {
      await client().storage.from(BUCKET).remove(group);
    }
    must(await client().from("journals").delete().eq("id", id));
  },

  // ---------- pages ----------
  async listPages(journalId) {
    const rows = must(
      await client().from("pages").select("*").eq("journal_id", journalId).order("position", { ascending: true }).order("created_at", { ascending: true })
    ) as any[];
    return rows.map(toPage);
  },

  async savePages(_journalId, upserts, deleteIds) {
    for (const group of chunk(upserts, 50)) {
      must(await client().from("pages").upsert(group.map(toPageRow), { onConflict: "id" }));
    }
    for (const group of chunk(deleteIds, 50)) {
      must(await client().from("pages").delete().in("id", group));
    }
  },

  // ---------- photo library ----------
  async listPhotos(journalId) {
    const rows = must(
      await client()
        .from("photos")
        .select("*, uploader:profiles!uploaded_by(display_name)")
        .eq("journal_id", journalId)
        .order("created_at", { ascending: true })
    ) as any[];
    return rows.map(toPhoto);
  },

  async uploadPhoto(journalId, file, processed) {
    const userId = await currentUserId();
    const id = uid();
    const base = `${journalId}/${id}`;
    const originalPath = `${base}/original.${extensionOf(file)}`;
    const uploaded: string[] = [];
    try {
      const sb = client().storage.from(BUCKET);
      for (const [path, body, type] of [
        [originalPath, file, file.type || "application/octet-stream"],
        [`${base}/display.jpg`, processed.display, "image/jpeg"],
        [`${base}/thumb.jpg`, processed.thumb, "image/jpeg"],
      ] as Array<[string, Blob, string]>) {
        const { error } = await sb.upload(path, body, { contentType: type, upsert: false });
        if (error) throw new Error(error.message);
        uploaded.push(path);
      }
      const { data: profile } = await client().from("profiles").select("display_name").eq("id", userId).maybeSingle();
      must(
        await client().from("photos").insert({
          id,
          journal_id: journalId,
          uploaded_by: userId,
          filename: file.name,
          original_path: originalPath,
          width: processed.width,
          height: processed.height,
          size_bytes: file.size,
          taken_at: processed.takenAt,
        })
      );
      const photo: Photo = {
        id,
        journalId,
        uploadedBy: userId,
        uploaderName: (profile as any)?.display_name ?? "",
        filename: file.name,
        width: processed.width,
        height: processed.height,
        sizeBytes: file.size,
        takenAt: processed.takenAt,
        createdAt: new Date().toISOString(),
        originalPath,
      };
      const urls: PhotoUrls = { thumb: URL.createObjectURL(processed.thumb), display: URL.createObjectURL(processed.display) };
      return { photo, urls };
    } catch (e) {
      if (uploaded.length) await client().storage.from(BUCKET).remove(uploaded);
      throw e;
    }
  },

  async deletePhoto(photo) {
    // Remove the files first (the storage rule checks the photo row), then the row.
    const paths = [photo.originalPath, displayPath(photo), thumbPath(photo)].filter(Boolean) as string[];
    await client().storage.from(BUCKET).remove(paths);
    must(await client().from("photos").delete().eq("id", photo.id));
  },

  async getPhotoUrls(photos, sizes) {
    const wanted: Array<{ id: string; size: "thumb" | "display"; path: string }> = [];
    for (const p of photos) {
      for (const size of sizes) wanted.push({ id: p.id, size, path: size === "thumb" ? thumbPath(p) : displayPath(p) });
    }
    const urls = await signedUrls(wanted.map((w) => w.path));
    const out: Record<string, PhotoUrls> = {};
    for (const w of wanted) {
      out[w.id] = { ...(out[w.id] ?? {}), [w.size]: urls[w.path] };
    }
    return out;
  },

  // ---------- sharing ----------
  async listMembers(journalId) {
    const rows = must(
      await client()
        .from("journal_members")
        .select("user_id, role, created_at, profile:profiles!user_id(display_name, email)")
        .eq("journal_id", journalId)
        .order("created_at", { ascending: true })
    ) as any[];
    return rows.map<Member>((r) => ({
      userId: r.user_id,
      role: r.role,
      displayName: r.profile?.display_name || r.profile?.email || "Someone",
      email: r.profile?.email ?? "",
      joinedAt: r.created_at,
    }));
  },

  async removeMember(journalId, userId) {
    must(await client().from("journal_members").delete().eq("journal_id", journalId).eq("user_id", userId));
  },

  async createInvite(journalId, email) {
    const token = randomToken();
    const id = uid();
    must(await client().from("journal_invites").insert({ id, journal_id: journalId, email: email || null, token }));
    const now = Date.now();
    return {
      id,
      journalId,
      email: email || null,
      token,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 14 * 24 * 3600 * 1000).toISOString(),
      revoked: false,
      acceptedBy: null,
    } satisfies Invite;
  },

  async listInvites(journalId) {
    const rows = must(
      await client()
        .from("journal_invites")
        .select("*")
        .eq("journal_id", journalId)
        .is("accepted_by", null)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
    ) as any[];
    return rows
      .filter((r) => new Date(r.expires_at).getTime() > Date.now())
      .map<Invite>((r) => ({
        id: r.id,
        journalId: r.journal_id,
        email: r.email,
        token: r.token,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        revoked: r.revoked,
        acceptedBy: r.accepted_by,
      }));
  },

  async revokeInvite(inviteId) {
    must(await client().from("journal_invites").update({ revoked: true }).eq("id", inviteId));
  },

  async getInviteInfo(token) {
    const rows = must(await client().rpc("get_invite_info", { p_token: token })) as any[];
    const r = rows?.[0];
    return r ? ({ journalTitle: r.journal_title, inviterName: r.inviter_name, email: r.email } satisfies InviteInfo) : null;
  },

  async acceptInvite(token) {
    return must(await client().rpc("accept_invite", { p_token: token })) as string;
  },

  // ---------- printed-book interest ----------
  async hasBookInterest(journalId) {
    const { data, error } = await client().from("journal_book_interests").select("journal_id").eq("journal_id", journalId).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async markBookInterest(journalId) {
    const userId = await currentUserId();
    const { error } = await client().from("journal_book_interests").insert({ journal_id: journalId, user_id: userId });
    // 23505 = already recorded, which is fine.
    if (error && error.code !== "23505") throw new Error(error.message);
  },
};

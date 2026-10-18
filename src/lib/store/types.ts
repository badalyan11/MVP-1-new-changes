import type {
  AuthUser,
  Invite,
  InviteInfo,
  Journal,
  JournalSummary,
  Member,
  Page,
  Photo,
  PhotoUrls,
  Role,
} from "../../types";
import type { ProcessedImage } from "../imageProcessing";

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "PASSWORD_RECOVERY";

/**
 * Everything the app needs from a backend. There are two implementations:
 * Supabase (accounts, database, private photo storage) and a local-only
 * fallback used when Supabase isn't configured.
 */
export interface Store {
  kind: "cloud" | "local";

  // --- accounts ---
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (event: AuthEvent, user: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  getAccessToken(): Promise<string | null>;

  // --- albums ---
  listJournals(): Promise<JournalSummary[]>;
  getJournal(id: string): Promise<{ journal: Journal; role: Role } | null>;
  createJournal(journal: Journal, firstPage: Page): Promise<void>;
  updateJournal(id: string, patch: Partial<Pick<Journal, "title" | "subject" | "dateLabel" | "design" | "customTypeDescription">>): Promise<void>;
  deleteJournal(id: string): Promise<void>;

  // --- pages ---
  listPages(journalId: string): Promise<Page[]>;
  savePages(journalId: string, upserts: Page[], deleteIds: string[]): Promise<void>;

  // --- the album's photo library ---
  listPhotos(journalId: string): Promise<Photo[]>;
  uploadPhoto(journalId: string, file: File, processed: ProcessedImage): Promise<{ photo: Photo; urls: PhotoUrls }>;
  deletePhoto(photo: Photo): Promise<void>;
  getPhotoUrls(photos: Photo[], sizes: Array<"thumb" | "display">): Promise<Record<string, PhotoUrls>>;

  // --- sharing ---
  listMembers(journalId: string): Promise<Member[]>;
  removeMember(journalId: string, userId: string): Promise<void>;
  createInvite(journalId: string, email: string | null): Promise<Invite>;
  listInvites(journalId: string): Promise<Invite[]>;
  revokeInvite(inviteId: string): Promise<void>;
  getInviteInfo(token: string): Promise<InviteInfo | null>;
  acceptInvite(token: string): Promise<string>;

  // --- feedback signal for printed albums ---
  hasBookInterest(journalId: string): Promise<boolean>;
  markBookInterest(journalId: string): Promise<void>;
}

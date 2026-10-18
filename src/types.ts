export type JournalMode = "ongoing" | "experience";
export type Role = "owner" | "collaborator";

export type PageStyleId =
  | "minimal-album"
  | "clean-editorial"
  | "warm-paper"
  | "classic-keepsake"
  | "floral"
  | "botanical"
  | "subtle-scrapbook";

export interface JournalDesign {
  presetId: string; // a DESIGN_PRESETS id, or "custom"
  coverColor: string;
  coverPhotoId: string | null; // a photo in the album's library
  coverFocusX?: number; // 0-100: which part of the cover photo stays in view (default 50)
  coverFocusY?: number;
  titleFont: string; // a TITLE_FONTS id
  pageStyle: PageStyleId; // the album's default page style
  accentColor: string;
}

export interface Journal {
  id: string;
  ownerId: string;
  title: string;
  mode: JournalMode;
  journalType: string; // an id from ONGOING_TYPES / EXPERIENCE_TYPES, or "other"
  customTypeDescription: string;
  subject: string;
  dateLabel: string;
  design: JournalDesign;
  createdAt: string;
  updatedAt: string;
}

export interface JournalSummary extends Journal {
  role: Role;
  pageCount: number;
  photoCount: number;
  coverUrl: string | null;
}

/** A photo in an album's shared library. Photos belong to the album, never to a page. */
export interface Photo {
  id: string;
  journalId: string;
  uploadedBy: string;
  uploaderName: string;
  filename: string;
  width: number; // pixel size of the ORIGINAL (after orientation)
  height: number;
  sizeBytes: number;
  takenAt: string | null;
  createdAt: string;
  originalPath?: string; // storage path of the untouched upload (cloud only)
}

export interface PhotoUrls {
  thumb?: string;
  display?: string;
}

/**
 * Coordinates are in "page units": x/w are percent of ONE page's width
 * (so a two-page spread canvas runs 0..200) and y/h are percent of page height.
 * Crop data is stored separately from the photo so the original is never altered.
 */
export interface PhotoElement {
  id: string;
  type: "photo";
  photoId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number; // >= 1, relative to "cover" fit
  panX: number; // 0..1 (which part of the overflow is visible)
  panY: number;
  userCrop?: boolean; // true once the user adjusted the crop by hand
  frame: "none" | "white";
}

export interface TextElement {
  id: string;
  type: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  story: string;
  date: string; // ISO date or ""
  showDate: boolean;
  align: "left" | "center";
  scale?: number; // text size multiplier, 1 = default
}

export type PageElement = PhotoElement | TextElement;

export interface PageMeta {
  roughNote?: string; // what the person originally wrote, kept for rewrites
  aiUsed?: boolean;
  aiEdited?: boolean;
}

export interface Page {
  id: string;
  journalId: string;
  position: number;
  span: 1 | 2; // 2 = one design across a two-page spread
  style: PageStyleId | null; // null = use the album's default
  autoLayout: boolean; // true until the person arranges something by hand
  layoutId: string | null;
  elements: PageElement[];
  meta: PageMeta;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  displayName: string;
  email: string;
  joinedAt: string;
}

export interface Invite {
  id: string;
  journalId: string;
  email: string | null;
  token: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  acceptedBy: string | null;
}

export interface InviteInfo {
  journalTitle: string;
  inviterName: string;
  email: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

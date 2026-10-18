import type { JournalMode, PageStyleId } from "../types";

export interface TypeOption {
  id: string;
  label: string;
  blurb: string;
}

export const ONGOING_TYPES: TypeOption[] = [
  { id: "childhood", label: "Childhood", blurb: "Every little first, and the everyday moments too." },
  { id: "relationship", label: "Relationship", blurb: "The story of you two, one moment at a time." },
  { id: "family", label: "Family", blurb: "The moments that make your family yours." },
  { id: "friends", label: "Friends", blurb: "The people who feel like home." },
  { id: "school", label: "School / College", blurb: "The years you'll want to remember clearly." },
  { id: "personal", label: "Personal", blurb: "A place just for you and your thoughts." },
  { id: "other", label: "Other", blurb: "Tell us what this journal is about." },
];

export const EXPERIENCE_TYPES: TypeOption[] = [
  { id: "vacation", label: "Vacation / Travel", blurb: "Turn the trip into a story you can flip through." },
  { id: "wedding", label: "Wedding", blurb: "The day, told the way you felt it." },
  { id: "birthday", label: "Birthday", blurb: "The celebration, kept exactly as it happened." },
  { id: "graduation", label: "Graduation", blurb: "The finish line, and everything it took to get there." },
  { id: "anniversary", label: "Anniversary", blurb: "A milestone worth writing down." },
  { id: "celebration", label: "Celebration", blurb: "A reason to remember, in your own words." },
  { id: "specialEvent", label: "Special Event", blurb: "One day, written down before it fades." },
  { id: "other", label: "Other", blurb: "Tell us what this experience was." },
];

export function getTypeOptions(mode: JournalMode): TypeOption[] {
  return mode === "ongoing" ? ONGOING_TYPES : EXPERIENCE_TYPES;
}

export function getTypeLabel(mode: JournalMode, journalType: string, customTypeDescription: string): string {
  if (journalType === "other") return customTypeDescription || "Other";
  const option = getTypeOptions(mode).find((t) => t.id === journalType);
  return option?.label ?? journalType;
}

export interface DesignPreset {
  id: string;
  name: string;
  coverColor: string;
  accentColor: string;
  titleFont: string;
  pageStyle: PageStyleId;
  suggestedFor: string[];
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "classicLeather",
    name: "Classic Leather",
    coverColor: "#5B3A29",
    accentColor: "#C9A227",
    titleFont: "playfair",
    pageStyle: "classic-keepsake",
    suggestedFor: ["personal", "other"],
  },
  {
    id: "softBabyPastel",
    name: "Soft Baby Pastel",
    coverColor: "#D9ECE4",
    accentColor: "#6F9C8B",
    titleFont: "lora",
    pageStyle: "minimal-album",
    suggestedFor: ["childhood"],
  },
  {
    id: "romanticBlush",
    name: "Romantic Blush",
    coverColor: "#E8C6C6",
    accentColor: "#A24E5A",
    titleFont: "caveat",
    pageStyle: "floral",
    suggestedFor: ["relationship", "wedding", "anniversary"],
  },
  {
    id: "familyHeritage",
    name: "Family Heritage",
    coverColor: "#77816A",
    accentColor: "#3F3A2E",
    titleFont: "garamond",
    pageStyle: "botanical",
    suggestedFor: ["family", "school", "friends"],
  },
  {
    id: "modernMinimal",
    name: "Modern Minimal",
    coverColor: "#EDE8DE",
    accentColor: "#2F2F2F",
    titleFont: "lora",
    pageStyle: "clean-editorial",
    suggestedFor: ["personal"],
  },
  {
    id: "travelNotebook",
    name: "Travel Notebook",
    coverColor: "#C08A4E",
    accentColor: "#4A3117",
    titleFont: "garamond",
    pageStyle: "subtle-scrapbook",
    suggestedFor: ["vacation", "graduation", "celebration", "specialEvent", "birthday"],
  },
];

export function suggestPreset(journalType: string): DesignPreset {
  const match = DESIGN_PRESETS.find((p) => p.suggestedFor.includes(journalType));
  return match ?? DESIGN_PRESETS.find((p) => p.id === "modernMinimal")!;
}

export const COVER_COLORS = [
  "#EDE8DE", // cream
  "#E8C6C6", // blush
  "#77816A", // sage
  "#7B93A6", // dusty blue
  "#C08A4E", // terracotta
  "#3A3A3A", // charcoal
  "#C9A227", // mustard
  "#A79BC1", // lavender
  "#5B3A29", // deep brown
  "#D9ECE4", // soft mint
];

export const TITLE_FONTS: { id: string; label: string; cssClass: string }[] = [
  { id: "lora", label: "Lora", cssClass: "font-serif" },
  { id: "playfair", label: "Playfair Display", cssClass: "font-playfair" },
  { id: "garamond", label: "EB Garamond", cssClass: "font-garamond" },
  { id: "caveat", label: "Caveat", cssClass: "font-caveat" },
];

export function fontClassFor(titleFont: string): string {
  return TITLE_FONTS.find((f) => f.id === titleFont)?.cssClass ?? "font-serif";
}

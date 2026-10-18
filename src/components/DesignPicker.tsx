import { useState } from "react";
import type { JournalDesign, PageStyleId } from "../types";
import { COVER_COLORS, DESIGN_PRESETS, TITLE_FONTS, fontClassFor, suggestPreset } from "../lib/journalTypes";
import { PAGE_STYLE_DEFS } from "../lib/pageStyles";
import { JournalCover } from "./JournalCover";
import { PageBackground } from "./PageBackground";

/**
 * Choose a ready-made album design, or build your own. The cover photo isn't
 * chosen here (photos live in the album's library); pass `onPickCover` where a
 * library exists (album settings) to show that control.
 */
export function DesignPicker({
  title,
  journalType,
  value,
  onChange,
  coverUrl = null,
  onPickCover,
  onClearCover,
}: {
  title: string;
  journalType: string;
  value: JournalDesign;
  onChange: (design: JournalDesign) => void;
  coverUrl?: string | null;
  onPickCover?: () => void;
  onClearCover?: () => void;
}) {
  const [mode, setMode] = useState<"preset" | "custom">(value.presetId === "custom" ? "custom" : "preset");
  const suggested = suggestPreset(journalType);

  const applyPreset = (presetId: string) => {
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChange({
      presetId: preset.id,
      coverColor: preset.coverColor,
      coverPhotoId: value.coverPhotoId,
      titleFont: preset.titleFont,
      pageStyle: preset.pageStyle,
      accentColor: preset.accentColor,
    });
  };

  const setCustomField = <K extends keyof JournalDesign>(key: K, val: JournalDesign[K]) => {
    onChange({ ...value, presetId: "custom", [key]: val });
  };

  const swatches = (selected: string, pick: (color: string) => void) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {COVER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => pick(color)}
          className={`h-8 w-8 rounded-full ring-2 ${selected === color ? "ring-ink" : "ring-transparent"}`}
          style={{ backgroundColor: color }}
          aria-label={color}
        />
      ))}
    </div>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_260px]">
      <div>
        <div className="flex gap-2">
          {(["preset", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === m ? "bg-sage-dark text-white" : "bg-beige text-ink/70"}`}
            >
              {m === "preset" ? "Ready-made design" : "Design my own"}
            </button>
          ))}
        </div>

        {mode === "preset" ? (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {DESIGN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`rounded-xl p-2 text-left ring-2 transition ${
                  value.presetId === preset.id ? "ring-sage-dark" : "ring-transparent hover:ring-ink/10"
                }`}
              >
                <JournalCover
                  title={title || "Your Journal"}
                  design={{
                    presetId: preset.id,
                    coverColor: preset.coverColor,
                    coverPhotoId: null,
                    titleFont: preset.titleFont,
                    pageStyle: preset.pageStyle,
                    accentColor: preset.accentColor,
                  }}
                  size="small"
                />
                <p className="mt-1.5 text-xs font-medium text-ink/70">
                  {preset.name}
                  {preset.id === suggested.id && <span className="text-sage-dark"> · suggested</span>}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-ink/70">Cover color</p>
              {swatches(value.coverColor, (c) => setCustomField("coverColor", c))}
            </div>
            <div>
              <p className="text-sm font-medium text-ink/70">Accent color</p>
              {swatches(value.accentColor, (c) => setCustomField("accentColor", c))}
            </div>
            <div>
              <p className="text-sm font-medium text-ink/70">Title font</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TITLE_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setCustomField("titleFont", font.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${fontClassFor(font.id)} ${
                      value.titleFont === font.id ? "border-sage-dark bg-beige" : "border-ink/15 hover:bg-white"
                    }`}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm font-medium text-ink/70">Page style</p>
          <div className="mt-2 grid grid-cols-4 gap-2.5 sm:grid-cols-7">
            {PAGE_STYLE_DEFS.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setCustomField("pageStyle", style.id as PageStyleId)}
                className={`text-left`}
                title={style.label}
              >
                <div className={`relative aspect-square overflow-hidden rounded-md ring-2 ${value.pageStyle === style.id ? "ring-sage-dark" : "ring-ink/10"}`}>
                  <PageBackground styleId={style.id} accent={value.accentColor} />
                </div>
                <p className="mt-1 text-[10px] leading-tight text-ink/55">{style.label}</p>
              </button>
            ))}
          </div>
        </div>

        {onPickCover && (
          <div className="mt-6">
            <p className="text-sm font-medium text-ink/70">Cover photo</p>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={onPickCover} className="rounded-lg border border-ink/15 px-3.5 py-2 text-sm text-ink/80 hover:bg-white">
                {value.coverPhotoId ? "Change photo" : "Choose from the album's photos"}
              </button>
              {value.coverPhotoId && onClearCover && (
                <button type="button" onClick={onClearCover} className="text-sm text-ink/50 underline hover:text-ink/80">
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[260px] space-y-4 md:mx-0">
        <p className="text-sm font-medium text-ink/70">Preview</p>
        <JournalCover title={title || "Your Journal"} design={value} size="medium" coverUrl={coverUrl} />
        <div className="relative aspect-square overflow-hidden rounded-md shadow-sm ring-1 ring-black/5">
          <PageBackground styleId={value.pageStyle} accent={value.accentColor} />
          <div className="absolute inset-[14%] flex flex-col justify-center">
            <p className={`${fontClassFor(value.titleFont)} text-base`} style={{ color: value.accentColor }}>
              A sample page
            </p>
            <p className="mt-1.5 font-serif text-[11px] leading-relaxed text-ink/60">This is the paper your memories will sit on.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

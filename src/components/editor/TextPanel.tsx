import { useEffect, useRef } from "react";
import type { Page, PageMeta, TextElement } from "../../types";
import { WritingHelper } from "../WritingHelper";
import type { WritingContext } from "../../lib/ai";

const field =
  "mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage";

/** The words on a page: all optional. Appears only while the text is selected. */
export function TextPanel({
  page,
  el,
  context,
  onChange,
  onClose,
  onDelete,
}: {
  page: Page;
  el: TextElement;
  context: WritingContext;
  onChange: (patch: Partial<TextElement>, meta?: Partial<PageMeta>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !el.title && !el.story && !el.date;

  useEffect(() => {
    if (isNew) storyRef.current?.focus();
    // Focus once when the panel opens on an empty text box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.id]);

  const editedAfterAi = (patch: Partial<TextElement>): Partial<PageMeta> | undefined =>
    page.meta.aiUsed && patch.story !== undefined ? { aiEdited: true } : undefined;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-ink/10 bg-cream p-4 sm:w-[310px]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-base text-ink">Words on this page</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-full px-2 text-xl leading-none text-ink/50 hover:bg-beige hover:text-ink">
          &times;
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink/45">Everything here is optional.</p>

      <label className="mt-4 block text-xs font-medium text-ink/60">
        Title
        <input value={el.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Leave empty for no title" className={field} />
      </label>

      <div className="mt-3">
        <label className="block text-xs font-medium text-ink/60">
          Date
          <input
            type="date"
            value={el.date}
            onChange={(e) => onChange({ date: e.target.value, showDate: e.target.value ? true : false })}
            className={field}
          />
        </label>
        {el.date && (
          <label className="mt-1.5 flex items-center gap-2 text-xs text-ink/60">
            <input type="checkbox" checked={el.showDate} onChange={(e) => onChange({ showDate: e.target.checked })} />
            Show the date on the page
          </label>
        )}
      </div>

      <label className="mt-3 block text-xs font-medium text-ink/60">
        Story
        <textarea
          ref={storyRef}
          rows={7}
          value={el.story}
          onChange={(e) => onChange({ story: e.target.value }, editedAfterAi({ story: e.target.value }))}
          placeholder="Write it however it comes. Messy is fine."
          className={`${field} resize-y font-serif leading-relaxed`}
        />
      </label>

      <div className="mt-3 flex items-center gap-2 text-xs text-ink/60">
        Text size
        {([[0.8, "Smaller"], [1, "Default"], [1.3, "Larger"]] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange({ scale: value })}
            className={`rounded-full px-2.5 py-1 ${(el.scale ?? 1) === value ? "bg-beige text-ink" : "hover:bg-beige/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <WritingHelper
        text={el.story}
        context={context}
        originalNote={page.meta.aiUsed ? page.meta.roughNote : undefined}
        onUse={(suggestion, original) => onChange({ story: suggestion }, { roughNote: original, aiUsed: true, aiEdited: false })}
        onAppend={(additions) => onChange({ story: el.story ? `${el.story}\n${additions}` : additions }, { roughNote: undefined, aiUsed: false })}
      />

      <button onClick={onDelete} className="mt-6 self-start text-xs text-red-600 underline">
        Remove the words from this page
      </button>
    </aside>
  );
}

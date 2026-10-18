import { useMemo } from "react";
import { useAlbum } from "../context/AlbumContext";
import type { RenderEnv } from "../components/PageRenderer";

/** Everything the page renderer needs, taken from the open album. */
export function useRenderEnv(): RenderEnv {
  const { journal, photoUrls, photoById } = useAlbum();
  return useMemo(
    () => ({
      albumStyle: journal.design.pageStyle,
      accent: journal.design.accentColor,
      titleFont: journal.design.titleFont,
      urls: photoUrls,
      photoById,
    }),
    [journal.design.pageStyle, journal.design.accentColor, journal.design.titleFont, photoUrls, photoById]
  );
}

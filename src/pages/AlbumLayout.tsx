import { Outlet, useParams } from "react-router-dom";
import { AlbumProvider } from "../context/AlbumContext";

/** Loads one album and shares it with every screen inside it (reading, editing, pages, adding, settings). */
export function AlbumLayout() {
  const { journalId } = useParams<{ journalId: string }>();
  if (!journalId) return null;
  return (
    <AlbumProvider key={journalId} journalId={journalId}>
      <Outlet />
    </AlbumProvider>
  );
}

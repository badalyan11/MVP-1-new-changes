import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { RequireAuth } from "./components/RequireAuth";
import { SignIn } from "./pages/SignIn";
import { ResetPassword } from "./pages/ResetPassword";
import { AcceptInvite } from "./pages/AcceptInvite";
import { Welcome } from "./pages/Welcome";
import { MyJournals } from "./pages/MyJournals";
import { CreateJournal } from "./pages/CreateJournal";
import { AlbumLayout } from "./pages/AlbumLayout";
import { JournalView } from "./pages/JournalView";
import { AlbumEditor } from "./pages/AlbumEditor";
import { ManagePages } from "./pages/ManagePages";
import { AddMemory } from "./pages/AddMemory";
import { JournalSettings } from "./pages/JournalSettings";
import { BookPreview } from "./pages/BookPreview";
import { Stats } from "./pages/Stats";

export function App() {
  const { recovering } = useAuth();
  const location = useLocation();

  // Someone who followed a password-reset link goes straight to choosing a new password.
  if (recovering && location.pathname !== "/reset-password") return <Navigate to="/reset-password" replace />;

  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<MyJournals />} />
        <Route path="/welcome" element={<Welcome showBack />} />
        <Route path="/create" element={<CreateJournal />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/journal/:journalId" element={<AlbumLayout />}>
          <Route index element={<JournalView />} />
          <Route path="edit" element={<AlbumEditor />} />
          <Route path="pages" element={<ManagePages />} />
          <Route path="add" element={<AddMemory />} />
          <Route path="settings" element={<JournalSettings />} />
          <Route path="book" element={<BookPreview />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

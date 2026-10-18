import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAlbum } from "../context/AlbumContext";
import { Modal } from "./Modal";
import { store } from "../lib/store";
import type { Invite, Member } from "../types";

const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { journal, isOwner, userId } = useAlbum();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMembers(await store.listMembers(journal.id));
      if (isOwner) setInvites(await store.listInvites(journal.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load sharing details.");
    }
  }, [journal.id, isOwner]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (store.kind === "local") {
    return (
      <Modal title="Share this album" onClose={onClose}>
        <p className="text-sm text-ink/70">
          Sharing needs accounts. This copy of Life Journal isn't connected to a database yet, so everything stays in this browser.
          Follow the Supabase steps in the README to turn on accounts and shared albums.
        </p>
      </Modal>
    );
  }

  const createInvite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const invite = await store.createInvite(journal.id, email.trim() || null);
      setInvites((cur) => [invite, ...cur]);
      setEmail("");
      await copy(invite.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  const revoke = async (invite: Invite) => {
    await store.revokeInvite(invite.id);
    setInvites((cur) => cur.filter((i) => i.id !== invite.id));
  };

  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.displayName} from this album? Photos they added stay in the album.`)) return;
    await store.removeMember(journal.id, member.userId);
    setMembers((cur) => cur.filter((m) => m.userId !== member.userId));
  };

  const leave = async () => {
    if (!window.confirm("Leave this album? You'll lose access to it.")) return;
    await store.removeMember(journal.id, userId);
    navigate("/");
  };

  return (
    <Modal title="Share this album" onClose={onClose}>
      <p className="text-sm text-ink/60">
        {isOwner
          ? "Invite family and friends to add their photos and memories. This album stays private to the people you invite."
          : "People in this album can add photos and memories."}
      </p>

      <ul className="mt-4 divide-y divide-ink/10 rounded-xl bg-white/60 ring-1 ring-ink/5">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {m.displayName}
                {m.userId === userId && <span className="ml-1.5 text-xs font-normal text-ink/40">you</span>}
              </p>
              {m.email && <p className="truncate text-xs text-ink/50">{m.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-ink/50">{m.role === "owner" ? "Owner" : "Can add and edit their own"}</span>
              {isOwner && m.role !== "owner" && (
                <button onClick={() => void remove(m)} className="text-xs text-red-600 underline">
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <>
          <form onSubmit={createInvite} className="mt-5">
            <label className="block text-sm font-medium text-ink/70">Invite someone</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Their email (optional)"
                className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
              />
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 rounded-xl bg-sage-dark px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sage disabled:opacity-60"
              >
                Create link
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink/45">
              You'll get a private link to send them. With an email, only that email can use it. The link works once and expires in 14 days.
            </p>
          </form>

          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink/70">Waiting to be accepted</p>
              <ul className="mt-1.5 space-y-2">
                {invites.map((i) => (
                  <li key={i.id} className="rounded-xl bg-white/60 p-3 text-sm ring-1 ring-ink/5">
                    <p className="text-xs text-ink/50">{i.email ? `For ${i.email}` : "Anyone with the link"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <input readOnly value={linkFor(i.token)} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink/70 ring-1 ring-ink/10" />
                      <button onClick={() => void copy(i.token)} className="shrink-0 rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-white">
                        {copied === i.token ? "Copied" : "Copy"}
                      </button>
                      <button onClick={() => void revoke(i)} className="shrink-0 text-xs text-red-600 underline">
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <button onClick={() => void leave()} className="mt-5 text-sm text-red-600 underline">
          Leave this album
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateSession, useDeleteSession, useSessions } from "../hooks/useSessions";

export function SessionsPage() {
  const navigate = useNavigate();
  const { data: sessions, isLoading, isError } = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createSession.mutate(
      { title: newTitle.trim() },
      {
        onSuccess: (session) => {
          setNewTitle("");
          setCreating(false);
          navigate(`/sessions/${session.id}`);
        },
      },
    );
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    navigate("/login");
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sessions</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
            + New Session
          </button>
          <button className="btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {creating && (
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Session title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={createSession.isPending}>
            Create
          </button>
          <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {isLoading && <p className="status-text">Loading…</p>}
      {isError && <p className="status-text error">Failed to load sessions.</p>}

      <div className="session-list">
        {sessions?.length === 0 && (
          <p className="empty-state">No sessions yet. Create one to get started.</p>
        )}
        {sessions?.map((session) => (
          <div key={session.id} className="session-card">
            <Link to={`/sessions/${session.id}`} className="session-link">
              <span className="session-title">{session.title}</span>
              {session.date && <span className="session-date">{session.date}</span>}
            </Link>
            <button
              className="btn-icon btn-danger"
              onClick={() => deleteSession.mutate(session.id)}
              title="Delete session"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

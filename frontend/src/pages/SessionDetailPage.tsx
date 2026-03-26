import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useCreateScene,
  useDeleteScene,
  useReorderScenes,
  useSession,
  useUpdateScene,
} from "../hooks/useSession";
import { SceneList } from "../components/SceneList";

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const { data: session, isLoading, isError } = useSession(sessionId);
  const createScene = useCreateScene(sessionId);
  const updateScene = useUpdateScene(sessionId);
  const deleteScene = useDeleteScene(sessionId);
  const reorderScenes = useReorderScenes(sessionId);

  const [addingScene, setAddingScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");

  function handleAddScene(e: React.FormEvent) {
    e.preventDefault();
    if (!newSceneTitle.trim()) return;
    createScene.mutate(
      { title: newSceneTitle.trim() },
      {
        onSuccess: () => {
          setNewSceneTitle("");
          setAddingScene(false);
        },
      },
    );
  }

  if (isLoading) return <div className="status-text">Loading…</div>;
  if (isError || !session) return <div className="status-text error">Session not found.</div>;

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="back-link">
          ← Sessions
        </Link>
        <div className="session-meta">
          <h1>{session.title}</h1>
          {session.date && <span className="session-date">{session.date}</span>}
        </div>
        <button className="btn-primary" onClick={() => setAddingScene((a) => !a)}>
          + Add Scene
        </button>
      </div>

      {addingScene && (
        <form className="create-form" onSubmit={handleAddScene}>
          <input
            className="input"
            placeholder="Scene title"
            value={newSceneTitle}
            onChange={(e) => setNewSceneTitle(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={createScene.isPending}>
            Add
          </button>
          <button className="btn-ghost" type="button" onClick={() => setAddingScene(false)}>
            Cancel
          </button>
        </form>
      )}

      {session.scenes.length === 0 && !addingScene && (
        <p className="empty-state">No scenes yet. Add one to start building this session.</p>
      )}

      <SceneList
        scenes={session.scenes}
        onReorder={(ids) => reorderScenes.mutate(ids)}
        onUpdate={(id, patch) => updateScene.mutate({ id, ...patch })}
        onDelete={(id) => deleteScene.mutate(id)}
      />
    </div>
  );
}

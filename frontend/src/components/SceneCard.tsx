import { useRef, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { MarkdownBody } from "./MarkdownBody";
import type { Scene } from "../types";

interface Props {
  scene: Scene;
  onUpdate: (id: number, patch: { title?: string; body?: string }) => void;
  onDelete: (id: number) => void;
}

export function SceneCard({ scene, onUpdate, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [titleDraft, setTitleDraft] = useState(scene.title);
  const [bodyDraft, setBodyDraft] = useState(scene.body);

  const titleRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function commitTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== scene.title) {
      onUpdate(scene.id, { title: trimmed });
    } else {
      setTitleDraft(scene.title);
    }
  }

  function commitBody() {
    setEditingBody(false);
    if (bodyDraft !== scene.body) {
      onUpdate(scene.id, { body: bodyDraft });
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="scene-card">
      <div className="scene-header">
        <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          ⠿
        </span>

        {editingTitle ? (
          <input
            ref={titleRef}
            className="scene-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(scene.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className="scene-title"
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
          >
            {scene.title}
          </span>
        )}

        <div className="scene-actions">
          <button
            className="btn-icon"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▶" : "▼"}
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(scene.id)}
            title="Delete scene"
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="scene-body">
          {editingBody ? (
            <textarea
              className="scene-body-textarea"
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              onBlur={commitBody}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setBodyDraft(scene.body);
                  setEditingBody(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className="scene-body-preview"
              onClick={() => setEditingBody(true)}
              title="Click to edit"
            >
              {bodyDraft ? (
                <MarkdownBody content={bodyDraft} />
              ) : (
                <span className="placeholder">Click to add content…</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

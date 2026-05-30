import type { ReactNode } from 'react'

export type StageModalId = 'tokens' | 'effects' | 'aoe' | 'showcase' | 'background' | 'view' | 'settings'

interface Props {
  activeModal: StageModalId | null
  onOpenModal: (id: StageModalId) => void
  expanded: boolean
  onToggleExpand: () => void
}

function CircleIcon({ letter }: { letter: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <text x="11" y="11" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">{letter}</text>
    </svg>
  )
}

function RectIcon({ letter }: { letter: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <text x="11" y="11" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">{letter}</text>
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M9.5 3h3l.5 2a5.5 5.5 0 0 1 1.7 1l2-.7 1.5 2.6-1.6 1.2c.07.3.1.6.1.9s-.03.6-.1.9l1.6 1.2-1.5 2.6-2-.7a5.5 5.5 0 0 1-1.7 1l-.5 2h-3l-.5-2a5.5 5.5 0 0 1-1.7-1l-2 .7-1.5-2.6 1.6-1.2a5 5 0 0 1-.1-.9c0-.3.03-.6.1-.9L3.8 8.9l1.5-2.6 2 .7A5.5 5.5 0 0 1 9 5.7z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <circle cx="11" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const MENU_ITEMS: { id: StageModalId; label: string; icon: ReactNode }[] = [
  { id: 'tokens',     label: 'Tokens',      icon: <CircleIcon letter="T" /> },
  { id: 'effects',    label: 'Effects',     icon: <CircleIcon letter="E" /> },
  { id: 'aoe',        label: 'AOE Markers', icon: <CircleIcon letter="A" /> },
  { id: 'showcase',   label: 'Showcase',    icon: <RectIcon letter="S" /> },
  { id: 'background', label: 'Background',  icon: <RectIcon letter="B" /> },
  { id: 'view',       label: 'View',        icon: <RectIcon letter="V" /> },
  { id: 'settings',   label: 'Settings',    icon: <GearIcon /> },
]

export function StageMenuBar({ activeModal, onOpenModal, expanded, onToggleExpand }: Props) {
  return (
    <div className={`stage-menu-bar${expanded ? '' : ' stage-menu-bar--collapsed'}`}>
      {MENU_ITEMS.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`stage-menu-item${activeModal === id ? ' stage-menu-item--active' : ''}`}
          onClick={() => onOpenModal(id)}
          title={expanded ? undefined : label}
        >
          <span className="stage-menu-icon">{icon}</span>
          {expanded && <span className="stage-menu-label">{label}</span>}
        </button>
      ))}
      <button
        className="stage-menu-expand-btn"
        onClick={onToggleExpand}
        title={expanded ? 'Collapse menu' : 'Expand menu'}
      >
        {expanded ? '‹' : '›'}
      </button>
    </div>
  )
}

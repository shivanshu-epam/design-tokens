import { useMemo, useState, type ReactNode } from 'react';
import { buildTokenTree, collectLeaves, countLeaves, filterByQuery, type GroupedEntry, type TokenTreeNode } from '../tokens';

export function useFilteredTree<T>(record: Record<string, T>, query: string) {
  return useMemo(() => buildTokenTree(filterByQuery(record, query)), [record, query]);
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Filter by name…'}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          fontSize: 13,
          border: '1px solid #ccc',
          borderRadius: 6,
        }}
      />
      <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>
        {value.trim() ? `${resultCount} of ${totalCount} matching "${value.trim()}"` : `${totalCount} total`}
      </p>
    </div>
  );
}

// A subtree flattens into one plain list once its own descendant leaf
// count drops to this or below — small enough to scan without further
// disclosure. Above it, render one nested collapsible group per child
// folder instead, and apply the same rule inside each — exactly like a
// file-tree browser adapting its depth to how much is actually there,
// rather than assuming any fixed number of path segments means "a group."
const FLATTEN_THRESHOLD = 40;

// Recursively renders a TokenTreeNode: flat leaf list once small enough,
// otherwise one CollapsibleGroup per child folder, each applying the same
// rule. `renderLeaves` is the category-specific leaf UI (a swatch grid for
// colors, list rows for typography, etc.) — this component only decides
// WHEN to show a flat list vs. recurse, never how a leaf itself looks.
export function TokenGroup<T>({
  node,
  forceOpen,
  renderLeaves,
}: {
  node: TokenTreeNode<T>;
  forceOpen: boolean;
  renderLeaves: (entries: GroupedEntry<T>[]) => ReactNode;
}) {
  const total = countLeaves(node);
  if (total === 0) return null;
  if (total <= FLATTEN_THRESHOLD) {
    return <>{renderLeaves(collectLeaves(node))}</>;
  }
  // Oversized: recurse one level. Leaves sitting directly on THIS node
  // (a key that terminates exactly where another key continues past it)
  // still need to render, not silently drop just because the folder as a
  // whole is too big to flatten.
  const directLeaves = node.leaves.length > 0 ? renderLeaves(node.leaves) : null;
  const children = Array.from(node.children.entries()).sort(([a], [b]) => a.localeCompare(b));
  return (
    <>
      {directLeaves}
      {children.map(([name, child]) => (
        <CollapsibleGroup key={child.path} title={name} count={countLeaves(child)} forceOpen={forceOpen}>
          <TokenGroup node={child} forceOpen={forceOpen} renderLeaves={renderLeaves} />
        </CollapsibleGroup>
      ))}
    </>
  );
}

// Large variable collections (thousands of entries per collection/mode)
// stay collapsed by default so the page doesn't render everything at once;
// small groups and anything matching an active search open automatically.
export function CollapsibleGroup({
  title,
  count,
  forceOpen,
  children,
}: {
  title: string;
  count: number;
  forceOpen: boolean;
  children: ReactNode;
}) {
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const defaultOpen = count <= 60;
  const open = forceOpen || defaultOpen || manuallyOpened;

  return (
    <section style={{ marginBottom: 12, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setManuallyOpened((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          background: '#fafafa',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#888', fontWeight: 400 }}>
          {count} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </section>
  );
}

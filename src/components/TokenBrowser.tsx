import { useMemo, useState, type ReactNode } from 'react';
import { filterByQuery, groupBySection } from '../tokens';

export function useFilteredGroups<T>(record: Record<string, T>, query: string) {
  return useMemo(() => groupBySection(filterByQuery(record, query)), [record, query]);
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

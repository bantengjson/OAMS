'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LOCATION_TYPE_LABEL } from '@/types/api';
import type { LocationTreeNode } from '@/types/api';

export function LocationTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: LocationTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">Belum ada lokasi.</p>;
  }
  return (
    <ul role="tree" className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: LocationTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const selected = node.id === selectedId;

  return (
    <li
      role="treeitem"
      aria-label={node.name}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      data-inactive={node.isActive ? undefined : 'true'}
    >
      <div
        className={cn(
          'flex items-center gap-1 rounded-md pr-2',
          selected ? 'bg-primary/10' : 'hover:bg-muted',
          !node.isActive && 'opacity-60',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={`${expanded ? 'Tutup' : 'Buka'} ${node.name}`}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-6 w-6" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          <span className={cn('truncate', selected && 'font-medium text-primary')}>{node.name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {LOCATION_TYPE_LABEL[node.type]}
          </Badge>
          {!node.isActive ? (
            <Badge variant="muted" className="shrink-0 text-[10px]">
              Nonaktif
            </Badge>
          ) : null}
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul role="group" className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LocationTreeNode } from '@/types/api';
import { LocationTree } from './location-tree';

const tree: LocationTreeNode[] = [
  {
    id: 'hq',
    code: 'HQ',
    name: 'Kantor Pusat',
    type: 'OFFICE',
    isActive: true,
    children: [
      {
        id: 'ga',
        code: 'GA',
        name: 'Gedung A',
        type: 'BUILDING',
        isActive: true,
        children: [
          {
            id: 'l2',
            code: 'GA_L2',
            name: 'Lantai 2',
            type: 'FLOOR',
            isActive: false,
            children: [],
          },
        ],
      },
    ],
  },
];

describe('LocationTree', () => {
  it('renders nested nodes expanded by default with their type labels', () => {
    render(<LocationTree nodes={tree} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByText('Kantor Pusat')).toBeInTheDocument();
    expect(screen.getByText('Gedung A')).toBeInTheDocument();
    expect(screen.getByText('Lantai 2')).toBeInTheDocument();
    expect(screen.getAllByText('Kantor')).toHaveLength(1);
    expect(screen.getByText('Lantai')).toBeInTheDocument();
  });

  it('marks inactive nodes', () => {
    render(<LocationTree nodes={tree} selectedId={null} onSelect={() => undefined} />);
    const inactive = screen.getByRole('treeitem', { name: /Lantai 2/ });
    expect(inactive).toHaveAttribute('data-inactive', 'true');
    expect(screen.getByRole('treeitem', { name: /Gedung A/ })).not.toHaveAttribute(
      'data-inactive',
      'true',
    );
  });

  it('collapses and re-expands children when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<LocationTree nodes={tree} selectedId={null} onSelect={() => undefined} />);
    const hq = screen.getByRole('treeitem', { name: 'Kantor Pusat' });
    await user.click(within(hq).getByRole('button', { name: 'Tutup Kantor Pusat' }));
    expect(screen.queryByText('Gedung A')).not.toBeInTheDocument();
    expect(hq).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(hq).getByRole('button', { name: 'Buka Kantor Pusat' }));
    expect(screen.getByText('Gedung A')).toBeInTheDocument();
  });

  it('calls onSelect with the node id and highlights the selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<LocationTree nodes={tree} selectedId={null} onSelect={onSelect} />);
    await user.click(screen.getByText('Gedung A'));
    expect(onSelect).toHaveBeenCalledWith('ga');

    rerender(<LocationTree nodes={tree} selectedId="ga" onSelect={onSelect} />);
    expect(screen.getByRole('treeitem', { name: /Gedung A/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows an empty message when there are no nodes', () => {
    render(<LocationTree nodes={[]} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByText('Belum ada lokasi.')).toBeInTheDocument();
  });
});

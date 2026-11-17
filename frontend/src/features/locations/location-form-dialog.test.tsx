import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Location } from '@/types/api';
import { LocationFormDialog } from './location-form-dialog';

vi.mock('@/lib/api/locations', () => ({
  locationsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import { locationsApi } from '@/lib/api/locations';

const office = {
  id: 'hq',
  code: 'HQ',
  name: 'Kantor Pusat',
  type: 'OFFICE',
  description: null,
  isActive: true,
  parent: null,
  path: 'Kantor Pusat',
  createdAt: '',
  updatedAt: '',
} satisfies Location;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('LocationFormDialog', () => {
  beforeEach(() => {
    vi.mocked(locationsApi.list).mockReset();
    // the real <dialog> API is missing in jsdom
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('keeps the parent preselected while the parent options are still loading', async () => {
    let resolveList: (v: { data: Location[]; meta: never }) => void = () => undefined;
    vi.mocked(locationsApi.list).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve as typeof resolveList;
      }),
    );

    render(
      <LocationFormDialog
        open
        onClose={() => undefined}
        onSaved={() => undefined}
        initialType="BUILDING"
        initialParentId="hq"
      />,
      { wrapper },
    );

    const select = screen.getByLabelText(/Kantor induk/) as HTMLSelectElement;
    expect(select.value).toBe('hq');

    resolveList({
      data: [office],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } as never,
    });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Kantor Pusat' })).toBeInTheDocument());
    expect(select.value).toBe('hq');
  });

  it('shows no parent field for an office', () => {
    vi.mocked(locationsApi.list).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    render(
      <LocationFormDialog open onClose={() => undefined} onSaved={() => undefined} initialType="OFFICE" />,
      { wrapper },
    );
    expect(screen.queryByLabelText(/induk/)).not.toBeInTheDocument();
    expect(locationsApi.list).not.toHaveBeenCalled();
  });
});

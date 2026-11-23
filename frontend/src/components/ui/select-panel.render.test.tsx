import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldSelect, FilterSelect } from './select-panel';
import type { SelectOption } from './select-panel';

const rooms: SelectOption[] = [
  { value: 'a', label: 'A · Sekretariat' },
  { value: 'b', label: 'B · Ketua, Sekretaris & Bendahara' },
  { value: 'i', label: 'I · Dapur' },
];

function Filter({ onPick = () => undefined }: { onPick?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <FilterSelect
      label="Ruangan"
      value={value}
      onChange={(v) => {
        setValue(v);
        onPick(v);
      }}
      options={rooms}
    />
  );
}

describe('FilterSelect', () => {
  it('shows nothing until it is opened', () => {
    render(<Filter />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('semua');
  });

  it('picks an option and closes', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Filter onPick={onPick} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Dapur/ }));

    expect(onPick).toHaveBeenCalledWith('i');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('I · Dapur');
  });

  it('clears the filter from the first row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Filter onPick={onPick} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Dapur/ }));
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: 'Semua ruangan' }));

    expect(onPick).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button')).toHaveTextContent('semua');
  });

  it('walks the list with the arrow keys and takes the one under Enter', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Filter onPick={onPick} />);

    screen.getByRole('button').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');

    // row 0 is "Semua ruangan", so two steps down lands on the first room
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('closes on Escape without letting the key reach the dialog behind it', async () => {
    const user = userEvent.setup();
    const onDialogEscape = vi.fn();
    render(
      <div onKeyDown={(e) => e.key === 'Escape' && onDialogEscape()}>
        <Filter />
      </div>,
    );

    await user.click(screen.getByRole('button'));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onDialogEscape).not.toHaveBeenCalled();
  });
});

describe('FieldSelect', () => {
  function Field({ options = rooms }: { options?: SelectOption[] }) {
    const [value, setValue] = useState('');
    return (
      <FieldSelect value={value} onChange={setValue} placeholder="Pilih ruangan..." options={options} />
    );
  }

  it('shows the placeholder until something is chosen', async () => {
    const user = userEvent.setup();
    render(<Field />);
    expect(screen.getByRole('button')).toHaveTextContent('Pilih ruangan...');

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: /Sekretariat/ }));
    expect(screen.getByRole('button')).toHaveTextContent('A · Sekretariat');
  });

  it('offers no way back to nothing when the field has no empty choice', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('searches a long list and says so when nothing matches', async () => {
    const user = userEvent.setup();
    const many: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
      value: `r${i}`,
      label: `Ruang ${i}`,
    }));
    render(<Field options={many} />);

    await user.click(screen.getByRole('button'));
    const search = screen.getByLabelText('Cari ruangan');
    await user.type(search, 'ruang 1');
    // 1, 10 and 11
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await user.clear(search);
    await user.type(search, 'gudang');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Tidak ada yang cocok.')).toBeInTheDocument();
  });
});

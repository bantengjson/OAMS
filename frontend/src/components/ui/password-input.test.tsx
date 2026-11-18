import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('hides the password by default and reveals it on toggle', async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" aria-label="Password" />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    await user.type(input, 'rahasia');
    await user.click(screen.getByRole('button', { name: 'Tampilkan password' }));
    expect(input.type).toBe('text');
    expect(input.value).toBe('rahasia');

    await user.click(screen.getByRole('button', { name: 'Sembunyikan password' }));
    expect(input.type).toBe('password');
  });

  it('keeps the toggle out of the tab order so Enter still submits the form', () => {
    render(<PasswordInput id="pw" aria-label="Password" />);
    expect(screen.getByRole('button', { name: 'Tampilkan password' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });
});

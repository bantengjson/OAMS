import { nextRoomLetter } from './room-letter.js';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

describe('nextRoomLetter', () => {
  it('starts at A', () => {
    expect(nextRoomLetter([])).toBe('A');
  });

  it('continues after the office rooms A–O', () => {
    expect(nextRoomLetter('ABCDEFGHIJKLMNO'.split(''))).toBe('P');
  });

  it('goes to AA after Z', () => {
    expect(nextRoomLetter(AZ)).toBe('AA');
  });

  it('goes to BA after AZ', () => {
    expect(nextRoomLetter([...AZ, 'AA', 'AZ'])).toBe('BA');
  });

  it('ignores codes that are not room letters and gaps', () => {
    expect(nextRoomLetter(['KANTOR', 'A', 'C', 'AST_R1'])).toBe('D');
  });
});

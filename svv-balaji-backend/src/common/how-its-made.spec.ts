import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SetHowItsMadeUrlDto } from '../recipes/dto/recipe.dto';

const errors = (howItsMadeUrl: unknown) =>
  validateSync(plainToInstance(SetHowItsMadeUrlDto, { howItsMadeUrl })).map((e) => e.property);

describe('IsHowItsMadeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.instagram.com/reel/C1a2b3c4d5e/',
    'http://example.com/how-we-make-atta',
  ])('accepts %s', (url) => expect(errors(url)).toEqual([]));

  it.each([
    'javascript:alert(1)',
    'www.youtube.com/watch?v=x',
    'ftp://example.com/video.mp4',
    'not a link',
    `https://example.com/${'a'.repeat(500)}`,
  ])('refuses %s', (url) => expect(errors(url)).toEqual(['howItsMadeUrl']));

  it('allows clearing it', () => {
    expect(errors(null)).toEqual([]);
    expect(errors(undefined)).toEqual([]);
  });
});

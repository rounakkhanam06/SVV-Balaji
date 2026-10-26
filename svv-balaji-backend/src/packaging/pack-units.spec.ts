import { BadRequestException } from '@nestjs/common';
import { toUnit } from './packaging.service';

/** Pack weight is compared to run output in the run's unit (audit 22 Oct 2026). */
describe('toUnit', () => {
  it('converts grams and kilos', () => {
    expect(toUnit(500, 'G', 'KG')).toBeCloseTo(0.5);
    expect(toUnit(2, 'kg', 'G')).toBeCloseTo(2000);
    expect(toUnit(1, 'QUINTAL', 'KG')).toBe(100);
  });

  it('converts millilitres and litres', () => {
    expect(toUnit(250, 'ML', 'L')).toBeCloseTo(0.25);
  });

  it('refuses mass against volume and unknown units', () => {
    expect(() => toUnit(1, 'KG', 'L')).toThrow(BadRequestException);
    expect(() => toUnit(1, 'PACK', 'KG')).toThrow(BadRequestException);
  });
});

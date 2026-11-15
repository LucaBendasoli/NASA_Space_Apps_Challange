// Synthetic curves for UI demonstration; these are not scientific measurements.
/** @type {import("../lib/spectrum").CelestialObject[]} */
export const demoObjects = [
  { id: 'ngc', name: 'NGC 7023', category: 'Nebulosa de reflexão', color: '#9d8bff', scale: 1, shift: 0 },
  { id: 'orion', name: 'Nebulosa de Órion', category: 'Nebulosa de emissão', color: '#52d6c7', scale: .77, shift: .45 },
  { id: 'carina', name: 'Nebulosa de Carina', category: 'Nebulosa de emissão', color: '#f2ba72', scale: .56, shift: -.3 },
].map(({ scale, shift, ...object }) => ({ ...object, observations: ['2026-10-12', '2026-08-24', '2026-05-09'].map((date, index) => ({
  id: `${object.id}-${index}`, date, label: `Observação ${index + 1}`,
  points: Array.from({ length: 102 }, (_, band) => {
    const x = 5 + band * 23 / 101;
    const peak = (center, width, height) => height * Math.exp(-(((x - center - shift) / width) ** 2));
    return { wavelength: x, radiance: Math.max(0, (peak(7.7, .55, 52) + peak(11.3, .65, 76) + peak(17, 1.4, 32) + peak(23, 2.1, 20) + 12 + 5 * Math.sin(x * .8)) * scale * (1 - index * .09) + index * 2 * Math.sin(x)) };
  }),
})) }));

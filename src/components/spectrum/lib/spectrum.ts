export type SpectralPoint = { wavelength: number; radiance: number };
export type Observation = { id: string; date: string; label: string; points: SpectralPoint[] };
export type CelestialObject = { id: string; name: string; category: string; color: string; observations: Observation[] };
export const formatDate = (date: string, locale = 'pt-BR') => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));

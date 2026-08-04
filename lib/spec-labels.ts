/**
 * Technical vocabulary, for display.
 *
 * Clip metadata is stored in English because it comes off the camera and the
 * probe — `hevc`, `D-Log`, `DJI Inspire 3`, `Drone`. Two different things then
 * have to happen on an Arabic page:
 *
 *   1. Terms with a real Arabic equivalent get translated. "Drone" is درون to
 *      a Saudi DP; leaving it English is lazy, not technical.
 *   2. Terms that genuinely have no Arabic form — codec names, camera models,
 *      colour profiles — stay Latin but MUST be isolated, or the bidi
 *      algorithm drags their punctuation and digits to the wrong end of the
 *      Arabic sentence around them. "Rec.709" next to Arabic renders as
 *      "709.Rec" without isolation.
 *
 * `specLabel` answers (1); the `<Spec>` renderers apply (2) to whatever comes
 * back still in Latin.
 */

const MOVEMENT: Record<string, string> = {
  Drone: 'درون',
  Gimbal: 'جيمبل',
  Handheld: 'كاميرا محمولة',
  Static: 'ثابتة',
  Slider: 'سلايدر',
  Crane: 'كرين',
  Dolly: 'دوللي',
  Tracking: 'تتبع',
}

const SHOT_SIZE: Record<string, string> = {
  Wide: 'واسعة',
  'Extreme wide': 'واسعة جداً',
  Medium: 'متوسطة',
  'Close-up': 'قريبة',
  Macro: 'ماكرو',
  Aerial: 'جوية',
}

const TIME_OF_DAY: Record<string, string> = {
  dawn: 'فجر',
  'golden hour': 'الساعة الذهبية',
  sunrise: 'شروق',
  day: 'نهار',
  dusk: 'غسق',
  sunset: 'غروب',
  night: 'ليل',
  'blue hour': 'الساعة الزرقاء',
}

const SEASON: Record<string, string> = {
  winter: 'شتاء',
  spring: 'ربيع',
  summer: 'صيف',
  autumn: 'خريف',
}

const TABLES: Record<string, Record<string, string>> = {
  movement: MOVEMENT,
  shotSize: SHOT_SIZE,
  timeOfDay: TIME_OF_DAY,
  season: SEASON,
}

/**
 * Translate a technical value, or hand it back unchanged when there is no
 * Arabic form. The caller decides how to isolate what comes back.
 */
export function specLabel(kind: keyof typeof TABLES | string, value: string | null | undefined) {
  if (!value) return null
  const table = TABLES[kind]
  return table?.[value] ?? value
}

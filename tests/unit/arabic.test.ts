import { describe, expect, it } from 'vitest'
import { kashida, stripKashida } from '@/lib/arabic'

const T = 'ـ'

describe('kashida', () => {
  it('reproduces the reference line exactly', () => {
    // "محتوى رايــح أبعــد" — رايح and أبعد draw out, محتوى does not, because
    // its penultimate letter is و and و joins nothing after it.
    expect(kashida('محتوى رايح أبعد')).toBe(`محتوى راي${T.repeat(2)}ح أبع${T.repeat(2)}د`)
  })

  it('declines on every letter that does not join forward', () => {
    // Penultimate is the non-joiner in each case, so there is no stroke to
    // lengthen and the word must come back untouched.
    for (const word of ['أولاد', 'يزور', 'بذور', 'قراء']) {
      expect(kashida(word)).toBe(word)
    }
  })

  it('elongates where the penultimate letter does join forward', () => {
    expect(kashida('لقطة', 3)).toBe(`لقط${T.repeat(3)}ة`)
    expect(kashida('المملكة')).toBe(`المملك${T.repeat(2)}ة`)
    expect(kashida('يريد')).toBe(`يري${T.repeat(2)}د`)
    // الرياض ends ...ا ض — alef never joins forward, so it declines.
    expect(kashida('الرياض')).toBe('الرياض')
  })

  it('never splits the lam-alef ligature', () => {
    // ل does join forward, so the joining test alone would allow this. لا is
    // a single ligature and a tatweel between them strands the alef.
    for (const word of ['العلا', 'أهلا', 'مثلا']) {
      expect(kashida(word)).toBe(word)
    }
  })

  it('leaves words of fewer than three letters alone', () => {
    expect(kashida('في')).toBe('في')
    expect(kashida('من')).toBe('من')
  })

  it('passes Latin, numerals and mixed tokens through untouched', () => {
    expect(kashida('Laqta 4K')).toBe('Laqta 4K')
    expect(kashida('العلا 2026')).toBe('العلا 2026')
  })

  it('preserves the original whitespace', () => {
    expect(stripKashida(kashida('لقطات  سعودية'))).toBe('لقطات  سعودية')
  })

  it('round-trips through stripKashida for any input', () => {
    for (const s of ['المملكة كما هي فعلاً', 'بعدسة تعرف المكان', 'لا اشتراكات']) {
      expect(stripKashida(kashida(s, 4))).toBe(s)
    }
  })

  it('is a no-op at zero units', () => {
    expect(kashida('الرياض', 0)).toBe('الرياض')
  })

  it('never inserts a tatweel at the end of a word', () => {
    for (const s of ['الرياض', 'لقطة', 'المملكة']) {
      expect(kashida(s).endsWith(T)).toBe(false)
    }
  })
})

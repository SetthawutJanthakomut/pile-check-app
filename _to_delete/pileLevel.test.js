
describe('products shown in the formula (BD3-3, 05-Nov)', () => {
  it('returns each length × f rounded to 3 dp, and the levels add up from them', () => {
    const r = computePileLevels({ hi: 5.15, mark: 34.803, seabed: -16.44, V: 4.825, L: 37.2, Lc: 27.2 });
    expect(r.f).toBe(0.979);
    expect(r.markF).toBe(34.072);
    expect(r.LF).toBe(36.419);
    expect(r.LcF).toBe(26.629);
    expect(r.tip).toBe(-28.922);
    expect(r.top).toBe(7.497);
    expect(r.coatingBottom).toBe(-19.132);
  });
});

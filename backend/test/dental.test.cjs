const test = require('node:test');
const assert = require('node:assert/strict');
const { dentitionForAge, teethFor, parseTeeth, normalizeFaces, quadrantTeeth } = require('../dist/src/utils/dental.js');

const birth = (years, now) => { const d = new Date(now); d.setFullYear(d.getFullYear() - years); return d; };

test('dentition follows the age (spec 6.1)', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  assert.equal(dentitionForAge(birth(4, now), now), 'PRIMARY');
  assert.equal(dentitionForAge(birth(8, now), now), 'MIXED');
  assert.equal(dentitionForAge(birth(12, now), now), 'PERMANENT');
  assert.equal(dentitionForAge(null, now), 'PERMANENT');
});

test('tooth counts per dentition', () => {
  assert.equal(teethFor('PERMANENT').length, 32);
  assert.equal(teethFor('PRIMARY').length, 20);
  assert.equal(teethFor('MIXED').length, 52);
  assert.deepEqual(quadrantTeeth(4), [41, 42, 43, 44, 45, 46, 47, 48]);
  assert.deepEqual(quadrantTeeth(8), [81, 82, 83, 84, 85]);
});

test('FDI parsing accepts valid teeth and rejects others', () => {
  assert.deepEqual(parseTeeth('36, 37'), [36, 37]);
  assert.deepEqual(parseTeeth([46]), [46]);
  assert.throws(() => parseTeeth('19'));
  assert.throws(() => parseTeeth('56'));
});

test('faces are normalised in a fixed order', () => {
  assert.equal(normalizeFaces('d,o,m'), 'M,D,O');
  assert.equal(normalizeFaces(''), null);
  assert.throws(() => normalizeFaces('X'));
});

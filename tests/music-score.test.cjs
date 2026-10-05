const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(relativePath, imports = {}) {
  const source = readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (id) => {
      assert.ok(Object.hasOwn(imports, id), `Unexpected import: ${id}`);
      return imports[id];
    },
  }, { filename: relativePath });
  return module.exports;
}

const tiers = loadTypeScript('src/lib/valueTier.ts');
const artistRanks = loadTypeScript('src/lib/artistRank.ts');
const { computeRZTScore, scoreToTier, VIBE_COEFFICIENTS, RZT_PARAMS } = loadTypeScript('src/types/music.ts', {
  '@/lib/valueTier': tiers,
});

test('four independent experience criteria use the existing storage positions', () => {
  assert.deepEqual(Array.from(RZT_PARAMS, ({ id }) => id), ['response', 'engagement', 'immersion', 'transformation']);
  assert.deepEqual(Array.from(RZT_PARAMS, ({ storageKey }) => storageKey), ['rhymes', 'structure', 'style', 'individuality']);
  assert.ok(RZT_PARAMS.every(({ question, hint }) => question && hint));
  for (let criterion = 0; criterion < 4; criterion += 1) {
    for (let value = 1; value <= 10; value += 1) {
      const ratings = [1, 1, 1, 1];
      ratings[criterion] = value;
      assert.equal(computeRZTScore(ratings, 1), Math.round((value + 3) * 1.4));
    }
  }
});

test('all five atmosphere coefficients retain rounding and the 90 point cap', () => {
  assert.deepEqual(Array.from(VIBE_COEFFICIENTS), [1, 1.1518, 1.3036, 1.4554, 1.6072]);
  for (let level = 1; level <= 5; level += 1) {
    assert.equal(computeRZTScore([5, 5, 5, 5], level), Math.round(28 * VIBE_COEFFICIENTS[level - 1]));
  }
  assert.equal(computeRZTScore([10, 10, 10, 10], 5), 90);
  assert.equal(computeRZTScore([1, 1, 1, 1], 1), 6);
});

test('score tiers retain every boundary', () => {
  for (const [score, tier] of [[0, 'ვერცხლი'], [49, 'ვერცხლი'], [50, 'ოქრო'], [64, 'ოქრო'], [65, 'ზურმუხტი'], [74, 'ზურმუხტი'], [75, 'საფირონი'], [84, 'საფირონი'], [85, 'ლალი'], [90, 'ლალი']]) {
    assert.equal(scoreToTier(score), tier);
  }
});

test('release tier reads the overall score, not either role-group average', () => {
  assert.equal(tiers.releaseValueTier({ overall_score: 85, community_score: 40, critics_score: 40 }), 'ლალი');
  assert.equal(tiers.releaseValueTier({ overall_score: 49, community_score: 90, critics_score: 90 }), 'ვერცხლი');
  assert.equal(tiers.releaseValueTier({ overall_score: 0, community_score: 90 }), null);
  assert.equal(tiers.releaseValueTier({ community_score: 90 }), null);
});

test('artist status follows every agreed rank boundary, with no status for unranked artists', () => {
  for (const [rank, key] of [[1, 'legend'], [2, 'superstar'], [3, 'superstar'], [4, 'star'], [7, 'star'], [8, 'rising'], [11, 'rising'], [12, 'spark'], [15, 'spark'], [100, 'spark']]) {
    assert.equal(artistRanks.artistTierFromRank(rank).key, key);
  }
  for (const rank of [null, undefined, 0, -1, 1.5, Infinity]) {
    assert.equal(artistRanks.artistTierFromRank(rank), null);
  }
});

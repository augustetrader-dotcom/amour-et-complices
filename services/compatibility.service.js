const LANGUAGES = ["words", "quality_time", "gifts", "acts", "touch"];

function computeScores(answers) {
  const scores = Object.fromEntries(LANGUAGES.map((l) => [l, 0]));
  for (const answer of answers) {
    if (scores[answer.chosen_language] !== undefined) scores[answer.chosen_language] += 1;
  }
  return scores;
}

function getPrimaryLanguage(scores) {
  let best = LANGUAGES[0];
  for (const lang of LANGUAGES) if (scores[lang] > scores[best]) best = lang;
  return best;
}

function computeCompatibilityScore(scoresA, scoresB) {
  const dot = LANGUAGES.reduce((sum, l) => sum + scoresA[l] * scoresB[l], 0);
  const magA = Math.sqrt(LANGUAGES.reduce((sum, l) => sum + scoresA[l] ** 2, 0));
  const magB = Math.sqrt(LANGUAGES.reduce((sum, l) => sum + scoresB[l] ** 2, 0));
  if (magA === 0 || magB === 0) return 0;
  return Math.round((dot / (magA * magB)) * 100);
}

function generateInsights(scoresA, scoresB) {
  const primaryA = getPrimaryLanguage(scoresA);
  const primaryB = getPrimaryLanguage(scoresB);
  let biggestGapLanguage = LANGUAGES[0];
  let biggestGap = -1;
  for (const lang of LANGUAGES) {
    const gap = Math.abs(scoresA[lang] - scoresB[lang]);
    if (gap > biggestGap) { biggestGap = gap; biggestGapLanguage = lang; }
  }
  return {
    partner_a_primary: primaryA,
    partner_b_primary: primaryB,
    shared_primary: primaryA === primaryB ? primaryA : null,
    biggest_gap: { language: biggestGapLanguage, gap: biggestGap },
  };
}

module.exports = { LANGUAGES, computeScores, getPrimaryLanguage, computeCompatibilityScore, generateInsights };

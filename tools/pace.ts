/**
 * Is a pace a length setting or a difficulty setting?
 *
 *   npx tsx tools/pace.ts --runs=2500
 *   npx tsx tools/pace.ts --runs=2500 --quick=1.8 --deep=0.8   # try a calibration
 *   npx tsx tools/pace.ts --runs=1200 --policy=first           # always take option 1
 *
 * Plays the same seeds at all three paces with the same choice stream, so any
 * difference in the output is the engine's doing and not the chooser's. This
 * is what `PACE_EFFECT_SCALE` in `packages/engine/src/types.ts` is calibrated
 * against, and `--quick=`/`--deep=` let you sweep candidates without editing
 * the engine. Re-run it after adding or removing events: the deck's size sets
 * how many cards a career actually sees, which is what the scale corrects for.
 *
 * The legacy breakdown is printed per pace because the totals alone hide where
 * a gap comes from — the first useful finding here was that quick was ahead on
 * `loyalty` and `penalties` rather than on ability, because a pace that offers
 * fewer cards offers fewer chances to leave a club and fewer chances to take a
 * doping ban.
 */
import {
  createCareer,
  decide,
  mulberry32,
  selectIdentity,
  PACE_EFFECT_SCALE,
  type CareerState,
  type Pace,
} from '@bg/engine';
import { WORLD } from '@bg/content';

const IDENTITY = {
  lastName: 'Probe', shirtNumber: 9, foot: 'right' as const,
  countryId: 'eng', position: 'ST' as const, archetype: 'technical' as const,
};

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const RUNS = Number(arg('runs') ?? 2500);
const POLICY = arg('policy') ?? 'random';
if (arg('quick')) PACE_EFFECT_SCALE.quick = Number(arg('quick'));
if (arg('deep')) PACE_EFFECT_SCALE.deep = Number(arg('deep'));

console.log(`\n  ${RUNS} paired careers per pace · policy=${POLICY} · scales ${JSON.stringify(PACE_EFFECT_SCALE)}\n`);

for (const pace of ['quick', 'standard', 'deep'] as Pace[]) {
  const peaks: number[] = [];
  const legacies: number[] = [];
  const earnings: number[] = [];
  const parts: Record<string, number> = {};
  let events = 0;
  let seasons = 0;
  let moves = 0;
  let peakWage = 0;

  for (let i = 0; i < RUNS; i += 1) {
    let state: CareerState = selectIdentity(createCareer(`pace-${i}`, pace), IDENTITY, WORLD);
    const rng = mulberry32(i * 2654435761 + 1);
    let guard = 0;
    while (state.pending && guard < 400) {
      if (state.pending.kind === 'career_event') events += 1;
      const options = state.pending.options;
      const index =
        POLICY === 'first' ? 0
        : POLICY === 'last' ? options.length - 1
        : Math.floor(rng() * options.length);
      state = decide(state, options[index]!.id, WORLD);
      guard += 1;
    }

    peaks.push(Math.max(0, ...state.seasons.map((s) => s.overallEnd)));
    legacies.push(state.retirement?.legacyScore ?? 0);
    earnings.push(state.totals.grossEarnings);
    for (const entry of state.retirement?.breakdown ?? []) parts[entry.key] = (parts[entry.key] ?? 0) + entry.value;
    seasons += state.seasons.length;
    peakWage += Math.max(0, ...state.seasons.map((s) => s.earnings));
    const clubs = state.seasons.map((s) => s.clubId);
    for (let k = 1; k < clubs.length; k += 1) if (clubs[k] !== clubs[k - 1]) moves += 1;
  }

  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

  console.log(
    `  ${pace.padEnd(9)} peak mean ${mean(peaks).toFixed(2)}  p50 ${median(peaks)}  ` +
      `legacy p50 ${median(legacies)}  earnings p50 €${(median(earnings) / 1e6).toFixed(1)}M`,
  );
  console.log(
    `            ${(events / RUNS).toFixed(1)} event cards · ${(seasons / RUNS).toFixed(1)} seasons · ` +
      `${(moves / RUNS).toFixed(1)} club moves · best season €${(peakWage / RUNS / 1e6).toFixed(1)}M`,
  );
  console.log(
    `            legacy: ${Object.entries(parts)
      .map(([key, value]) => `${key} ${Math.round(value / RUNS)}`)
      .join('  ')}\n`,
  );
}

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PACE_DECISIONS } from '@bg/engine';

/**
 * The database has to accept every career the engine can produce.
 *
 * The engine renamed its shortest pace from `blitz` to `quick`; the edge
 * function followed and the table's check constraint did not. Every Quick
 * career after that passed the replay, failed the insert, and fell back to the
 * local estimate on the player's screen — no error anybody saw, and a board
 * with no Quick careers on it that was read as nobody choosing Quick. It was
 * found by the seeder, not by a test, and `sql/004` fixed it.
 *
 * So the three places that name the paces are held to the engine's list: the
 * latest constraint in `packages/backend/sql/`, and the edge function's own
 * validation. The constraint is read from the files because the files are the
 * schema's record; `sql/004` is where it was last set.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const sqlDir = join(root, 'packages', 'backend', 'sql');
const paces = Object.keys(PACE_DECISIONS).sort();

/** The pace list in the last SQL file that sets `bg_runs_pace_check`. */
function constraintPaces(): string[] {
  const files = readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();
  let last: string[] | null = null;
  for (const file of files) {
    const sql = readFileSync(join(sqlDir, file), 'utf8');
    const re = /add constraint bg_runs_pace_check check \(pace in \(([^)]*)\)\)/g;
    for (const match of sql.matchAll(re)) {
      last = [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
    }
  }
  if (!last) throw new Error('no file in packages/backend/sql sets bg_runs_pace_check');
  return last;
}

describe('the leaderboard schema', () => {
  it('accepts every pace the engine has', () => {
    expect(constraintPaces()).toEqual(paces);
  });

  it('is what the edge function validates against', () => {
    const handler = readFileSync(join(root, 'packages', 'backend', 'edge', 'handler.ts'), 'utf8');
    const match = /!\[([^\]]*)\]\.includes\(body\?\.pace\)/.exec(handler);
    expect(match, 'the pace check in handler.ts moved; update this test').not.toBeNull();
    const named = [...match![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
    expect(named).toEqual(paces);
  });
});

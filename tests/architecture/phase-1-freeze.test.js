'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { verify, REQUIRED } = require('../../scripts/verify-phase-1');

const root = path.resolve(__dirname, '../..');
describe('Phase 1 final source-tree evidence gate', () => {
  test('current repo preserves required foundation artifacts', () => {
    const result = verify(root);
    expect(result.checks.filter((c) => !c.passed)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  test('missing critical module makes gate fail closed', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase19-gate-'));
    try {
      for (const file of REQUIRED) {
        const destination = path.join(temp, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (file === 'src/shared/persistence/unit-of-work.js') continue;
        fs.copyFileSync(path.join(root, file), destination);
      }
      const result = verify(temp);
      expect(result.passed).toBe(false);
      expect(result.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'file:src/shared/persistence/unit-of-work.js', passed: false }),
      ]));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
});

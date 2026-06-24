import { describe, it, expect, beforeEach as vitestBeforeEach } from 'vitest';
import {
  describe as mtDescribe,
  it as mtIt,
  beforeEach as mtBeforeEach,
  expect as mtExpect,
  reset,
  runAll,
} from '../../src/dev/minitest';

vitestBeforeEach(() => {
  reset();
});

describe('minitest — pass/fail counting', () => {
  it('counts passing tests', async () => {
    mtDescribe('suite', () => {
      mtIt('passes', () => { mtExpect(1).toBe(1); });
      mtIt('also passes', () => { mtExpect('a').toBe('a'); });
    });
    const results = await runAll();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('counts failing tests', async () => {
    mtDescribe('suite', () => {
      mtIt('fails', () => { mtExpect(1).toBe(2); });
    });
    const results = await runAll();
    expect(results[0].passed).toBe(false);
    expect(results[0].error).toBeDefined();
  });

  it('records suite and test names', async () => {
    mtDescribe('my suite', () => {
      mtIt('my test', () => {});
    });
    const results = await runAll();
    expect(results[0].suite).toBe('my suite');
    expect(results[0].name).toBe('my test');
  });

  it('records duration as non-negative number', async () => {
    mtDescribe('s', () => {
      mtIt('t', () => {});
    });
    const results = await runAll();
    expect(results[0].durationMs >= 0).toBe(true);
  });
});

describe('minitest — beforeEach ordering', () => {
  it('runs beforeEach before each test', async () => {
    const log: string[] = [];
    mtDescribe('suite', () => {
      mtBeforeEach(() => { log.push('before'); });
      mtIt('t1', () => { log.push('t1'); });
      mtIt('t2', () => { log.push('t2'); });
    });
    await runAll();
    expect(log).toEqual(['before', 't1', 'before', 't2']);
  });

  it('beforeEach errors cause the test to fail', async () => {
    mtDescribe('suite', () => {
      mtBeforeEach(() => { throw new Error('hook failed'); });
      mtIt('t', () => {});
    });
    const results = await runAll();
    expect(results[0].passed).toBe(false);
  });
});

describe('minitest — onTestComplete callback', () => {
  it('calls callback after each test', async () => {
    const calls: string[] = [];
    mtDescribe('s', () => {
      mtIt('a', () => {});
      mtIt('b', () => {});
    });
    await runAll((r) => calls.push(r.name));
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('minitest — multiple suites', () => {
  it('runs tests from all registered suites', async () => {
    mtDescribe('A', () => { mtIt('a1', () => {}); });
    mtDescribe('B', () => { mtIt('b1', () => {}); });
    const results = await runAll();
    expect(results).toHaveLength(2);
    expect(results[0].suite).toBe('A');
    expect(results[1].suite).toBe('B');
  });
});

describe('minitest — reset()', () => {
  it('clears registered suites between calls', async () => {
    mtDescribe('s', () => { mtIt('t', () => {}); });
    reset();
    const results = await runAll();
    expect(results).toHaveLength(0);
  });
});

describe('minitest — expect matchers', () => {
  it('toBe: passes on strict equality', () => {
    expect(() => mtExpect(42).toBe(42)).not.toThrow();
  });

  it('toBe: throws on inequality', () => {
    expect(() => mtExpect(1).toBe(2)).toThrow();
  });

  it('toEqual: deep equality for objects', () => {
    expect(() => mtExpect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] })).not.toThrow();
  });

  it('toEqual: fails on shallow-different objects', () => {
    expect(() => mtExpect({ a: 1 }).toEqual({ a: 2 })).toThrow();
  });

  it('toEqual: handles nested arrays', () => {
    expect(() => mtExpect([1, [2, 3]]).toEqual([1, [2, 3]])).not.toThrow();
  });

  it('toBeNull: passes on null', () => {
    expect(() => mtExpect(null).toBeNull()).not.toThrow();
  });

  it('toBeNull: fails on undefined', () => {
    expect(() => mtExpect(undefined).toBeNull()).toThrow();
  });

  it('toBeDefined: passes on non-undefined', () => {
    expect(() => mtExpect(0).toBeDefined()).not.toThrow();
    expect(() => mtExpect(null).toBeDefined()).not.toThrow();
  });

  it('toBeDefined: fails on undefined', () => {
    expect(() => mtExpect(undefined).toBeDefined()).toThrow();
  });

  it('toBeUndefined: passes on undefined', () => {
    expect(() => mtExpect(undefined).toBeUndefined()).not.toThrow();
  });

  it('toContain: string contains substring', () => {
    expect(() => mtExpect('hello world').toContain('world')).not.toThrow();
  });

  it('toContain: array contains element', () => {
    expect(() => mtExpect([1, 2, 3]).toContain(2)).not.toThrow();
  });

  it('toContain: fails when absent', () => {
    expect(() => mtExpect([1, 2]).toContain(9)).toThrow();
  });

  it('toHaveLength: passes on correct length', () => {
    expect(() => mtExpect([1, 2, 3]).toHaveLength(3)).not.toThrow();
    expect(() => mtExpect('abc').toHaveLength(3)).not.toThrow();
  });

  it('toHaveLength: fails on wrong length', () => {
    expect(() => mtExpect([1]).toHaveLength(2)).toThrow();
  });

  it('toBeGreaterThan / toBeLessThan', () => {
    expect(() => mtExpect(5).toBeGreaterThan(4)).not.toThrow();
    expect(() => mtExpect(3).toBeLessThan(4)).not.toThrow();
    expect(() => mtExpect(4).toBeGreaterThan(4)).toThrow();
  });

  it('toBeTruthy / toBeFalsy', () => {
    expect(() => mtExpect(1).toBeTruthy()).not.toThrow();
    expect(() => mtExpect(0).toBeFalsy()).not.toThrow();
    expect(() => mtExpect(0).toBeTruthy()).toThrow();
  });

  it('toThrow: catches synchronous error', () => {
    expect(() => mtExpect(() => { throw new Error('boom'); }).toThrow()).not.toThrow();
  });

  it('toThrow: fails when function does not throw', () => {
    expect(() => mtExpect(() => {}).toThrow()).toThrow();
  });
});

describe('minitest — async tests', () => {
  it('awaits async test functions', async () => {
    mtDescribe('s', () => {
      mtIt('async pass', async () => {
        await Promise.resolve();
        mtExpect(1).toBe(1);
      });
      mtIt('async fail', async () => {
        await Promise.resolve();
        mtExpect(1).toBe(2);
      });
    });
    const results = await runAll();
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
  });
});

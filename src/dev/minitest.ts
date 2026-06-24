export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface Suite {
  name: string;
  tests: TestCase[];
  beforeEachFns: TestFn[];
}

let _suites: Suite[] = [];
let _currentSuite: Suite | null = null;

export function reset(): void {
  _suites = [];
  _currentSuite = null;
}

export function describe(name: string, fn: () => void): void {
  const suite: Suite = { name, tests: [], beforeEachFns: [] };
  _suites.push(suite);
  const prev = _currentSuite;
  _currentSuite = suite;
  fn();
  _currentSuite = prev;
}

export function it(name: string, fn: TestFn): void {
  if (!_currentSuite) throw new Error('it() called outside describe()');
  _currentSuite.tests.push({ name, fn });
}

export function beforeEach(fn: TestFn): void {
  if (!_currentSuite) throw new Error('beforeEach() called outside describe()');
  _currentSuite.beforeEachFns.push(fn);
}

class AssertionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AssertionError';
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;
  if (aIsArr && bIsArr) {
    const aArr = a as unknown[];
    const bArr = b as unknown[];
    if (aArr.length !== bArr.length) return false;
    return aArr.every((item, i) => deepEqual(item, bArr[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => deepEqual(aObj[k], bObj[k]));
}

function fmt(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

export function expect(value: unknown) {
  return {
    toBe(expected: unknown) {
      if (value !== expected) {
        throw new AssertionError(`toBe: expected ${fmt(expected)}, received ${fmt(value)}`);
      }
    },
    toEqual(expected: unknown) {
      if (!deepEqual(value, expected)) {
        throw new AssertionError(`toEqual: expected ${fmt(expected)}, received ${fmt(value)}`);
      }
    },
    toBeNull() {
      if (value !== null) {
        throw new AssertionError(`toBeNull: received ${fmt(value)}`);
      }
    },
    toBeDefined() {
      if (value === undefined) {
        throw new AssertionError('toBeDefined: received undefined');
      }
    },
    toBeUndefined() {
      if (value !== undefined) {
        throw new AssertionError(`toBeUndefined: received ${fmt(value)}`);
      }
    },
    toContain(item: unknown) {
      if (typeof value === 'string') {
        if (!value.includes(item as string)) {
          throw new AssertionError(`toContain: "${value}" does not contain ${fmt(item)}`);
        }
      } else if (Array.isArray(value)) {
        if (!value.includes(item)) {
          throw new AssertionError(`toContain: array does not contain ${fmt(item)}`);
        }
      } else {
        throw new AssertionError('toContain: value must be a string or array');
      }
    },
    toHaveLength(n: number) {
      const len = (value as { length?: number })?.length;
      if (len !== n) {
        throw new AssertionError(`toHaveLength: expected ${n}, received ${len}`);
      }
    },
    toBeGreaterThan(n: number) {
      if ((value as number) <= n) {
        throw new AssertionError(`toBeGreaterThan: expected > ${n}, received ${value}`);
      }
    },
    toBeLessThan(n: number) {
      if ((value as number) >= n) {
        throw new AssertionError(`toBeLessThan: expected < ${n}, received ${value}`);
      }
    },
    toBeTruthy() {
      if (!value) {
        throw new AssertionError(`toBeTruthy: received ${fmt(value)}`);
      }
    },
    toBeFalsy() {
      if (value) {
        throw new AssertionError(`toBeFalsy: received ${fmt(value)}`);
      }
    },
    toThrow() {
      if (typeof value !== 'function') {
        throw new AssertionError('toThrow: expected a function');
      }
      let threw = false;
      try {
        (value as () => void)();
      } catch {
        threw = true;
      }
      if (!threw) {
        throw new AssertionError('toThrow: function did not throw');
      }
    },
  };
}

export function getTestCount(): number {
  return _suites.reduce((acc, s) => acc + s.tests.length, 0);
}

export async function runAll(
  onTestComplete?: (result: TestResult) => void,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const suite of _suites) {
    for (const test of suite.tests) {
      const start = Date.now();
      let passed = false;
      let error: string | undefined;

      try {
        for (const hook of suite.beforeEachFns) {
          await hook();
        }
        await test.fn();
        passed = true;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const result: TestResult = {
        suite: suite.name,
        name: test.name,
        passed,
        durationMs: Date.now() - start,
        error,
      };

      results.push(result);
      onTestComplete?.(result);
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  return results;
}

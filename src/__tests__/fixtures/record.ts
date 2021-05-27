
interface TestValue {
    test: string;
}

interface Test {
    a: Record<string, string>;
    b: Record<number, string>;
    c: Record<'a' | 'b', string>;
    d: Record<string, boolean>;
    e: Record<string, number>;
    f: Record<string, TestValue>;
    g: Record<string, unknown>;
}
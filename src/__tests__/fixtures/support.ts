
interface TestValue {
    test: string;
}

interface RecordTest {
    a: Record<string, string>;
    b: Record<number, string>;
    c: Record<'a' | 'b', string>;
    d: Record<string, boolean>;
    e: Record<string, number>;
    f: Record<string, TestValue>;
    g: Record<string, unknown>;
}

type Hello = "Hello";
type World = "World";
type Foo = `${Hello} ${World}!`;
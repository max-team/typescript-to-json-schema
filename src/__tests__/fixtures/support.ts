import {GenericDataOuter, GenericDataReName as GenericDataRename} from './base';

interface TestValue {
    test: string;
    name: number;
    bool: boolean;
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

interface PickOmit {
    /** Pick */
    pick: Pick<TestValue, 'name'>;
    /** pickMulti */
    pickMulti: Pick<TestValue, 'name' | 'bool'>;
    omit: Omit<TestValue, 'name'>;
    omitMulti: Omit<TestValue, 'name' | 'bool'>;
}

interface GenericData<T, K> {
    data: K;
    type: T;
}

interface GenericTest {
    inner: GenericData<string, TestValue>;
    outer: GenericDataOuter<'0' | '1', TestValue>;
    outerRename: GenericDataRename<'0' | '1', TestValue>;
}


export enum ValEnum {
    val1 = 2,
    val2 = 3
}

type Person = {
    name: string;
    age: string;
};

export interface BaseType {
    /**
     * 字符串
     * @minLength 1
     * @maxLength 100
     * @pattern ^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$
     * @format uri
     */
    str: string;

    /**
     * 数字
     * @minimum 0
     * @exclusiveMinimum 0
     * @maximum 100
     * @exclusiveMaximum 100
     * @multipleOf 10
     */
    num: number;

    /** 布尔 */
    bool: boolean;

    /**
     * 数组
     * @minItems 1
     * @maxItems 10
     * @uniqueItems true
     */
    arr: string[];
    /** 数组：Array */
    arrTemp?: Array<string>;

    /** 枚举 */
    enum: ValEnum;
    /** 枚举 */
    enumUnion?: 2 | 3;

    /** Index Access */
    indexAccess: Person['age'];
}

type Hello = "Hello";
type World = "World";
export type Foo = `${Hello} ${World}!`;

interface CompositionType {
    /** 模板字符串 */
    tplLiteral: Foo;
}

export interface Simple {
    arr: number[];
}

interface RecordSupport {
    a: Record<string, string>;
    b: Record<number, string>;
    c: Record<'a' | 'b', string>;
    d: Record<string, boolean>;
    e: Record<string, number>;
    f: Record<string, Simple>;
    g: Record<string, unknown>;
}

interface PickSupport {
    single: Pick<BaseType, 'str'>;
    multi: Pick<BaseType, 'str' | 'num'>;
}

interface OmitSupport {
    single: Omit<BaseType, 'str'>;
    multi: Omit<BaseType, 'str' | 'num'>;
}

interface GenericTpl<T, K> {
    data: K;
    type: T;
}
interface GenericTest {
    a: GenericTpl<string, Simple>;
    b: GenericTpl<'0' | '1', Simple>;
}

interface ExtendSupport extends BaseType, CompositionType {
    custom: string;
}
interface RefExtendSupprt {
    a: ExtendSupport;
}

interface OneOfSupport {
    anyof: BaseType | BaseType[];
}

export namespace TestNameSpace {
    export interface Fooz {
        bar: number;
    }
    export namespace InnerSpace {
        export interface InnerFooz {
            bar: string;
        }
    }
}
interface NameSpaceSupport {
    a: TestNameSpace.Fooz;
    b: TestNameSpace.InnerSpace.InnerFooz;
}

export default interface DefaultExport {
    c: string;
}

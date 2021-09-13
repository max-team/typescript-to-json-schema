
interface GlobalSupport {
    a: ValEnum;
    b: Foo;
    c: Simple;
    d: TestNameSpace.Fooz;
    e: TestNameSpace.InnerSpace.InnerFooz;
}

interface UnSupportType {
    a: Date;
    b: string;
}

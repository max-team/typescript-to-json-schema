
interface GlobalSupport {
    a: ValEnum;
    b: Foo;
    c: Simple;
    d: TestNameSpace.Fooz;
    e: TestNameSpace.InnerSpace.InnerFooz;
    f: DefaultExport;
}

interface UnSupportType {
    a: Date;
    b: string;
}

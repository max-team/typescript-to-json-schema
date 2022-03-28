import DefaultExport, {ValEnum, Foo, Simple, TestNameSpace} from './support';

interface ImportSupport {
    a: ValEnum;
    b: Foo;
    c: Simple;
    d: TestNameSpace.Fooz;
    e: TestNameSpace.InnerSpace.InnerFooz;
    f: DefaultExport;
}

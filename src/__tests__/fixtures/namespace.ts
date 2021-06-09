namespace TestNameSpace {

    interface Test {
        a: string;
    }

    export interface Fooz {
        bar: number;
    }

    export const a = 1;

    export function test() {}
}

namespace EmptyNameSpace {
}

interface TestExt extends TestNameSpace.Fooz {
    barzz: string;
}

interface TestProp {
    barzz: TestNameSpace.Fooz;
}
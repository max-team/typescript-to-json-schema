
export interface GenericDataOuter<T, K> {
    name: string;
    data: K;
    type: T;
}

export interface GenericDataReName<T, K> {
    rename: string;
    data: K;
    type: T;
}
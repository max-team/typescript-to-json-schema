/**
 * @file 数组
 * @author cxtom(cxtom2008@gmail.com)
 */

import { integer } from "../..";

type employee = {

    /**
     * 雇员名字
     *
     * @maxLength 50
     * @minLength 1
     */
    name: string;

    /**
     * 雇员年龄
     *
     * @minimum 18
     */
    age: integer;
};

interface Department {

    /**
     * 是否开始
     */
    open: boolean | null;

    /**
     * 员工
     *
     * @maxItems 1000
     */
    employee: employee[]
}

export interface Company {

    /**
     * 部门
     *
     * @minItems 1
     */
    departments: Department[]
}

# typescript-to-json-schema

![Language](https://img.shields.io/badge/-TypeScript-blue.svg)
[![npm package](https://img.shields.io/npm/v/@hoth%2ftypescript-to-json-schema.svg)](https://www.npmjs.org/package/@hoth/typescript-to-json-schema)
[![Build Status](https://travis-ci.org/max-team/typescript-to-json-schema.svg?branch=master)](https://travis-ci.org/max-team/typescript-to-json-schema)

TypeScript to JsonSchema Transpiler

## Usage

### Programmatic use

```typescript
import {resolve} from 'path';
import {generateSchema} from '@hoth/typescript-to-json-schema';

const {schemas} = generateSchema([resolve('demo.ts')]);
```

### Annotations

For example

`company.ts`：

```typescript
import { integer } from "@hoth/typescript-to-json-schema";

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
```

output

```json
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "http://www.baidu.com/schemas/company.json",
      "$ref": "#/definitions/company",
      "definitions": {
        "department": {
          "type": "object",
          "properties": {
            "open": {
              "oneOf": [
                {
                  "type": "boolean"
                },
                {
                  "type": "null"
                }
              ],
              "description": "是否开始"
            },
            "employee": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/employee"
              },
              "maxItems": 1000,
              "description": "员工"
            }
          },
          "required": [
            "open",
            "employee"
          ]
        },
        "company": {
          "type": "object",
          "properties": {
            "departments": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/department"
              },
              "minItems": 1,
              "description": "部门"
            }
          },
          "required": [
            "departments"
          ]
        },
        "employee": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "maxLength": 50,
              "description": "雇员名字"
            },
            "age": {
              "type": "integer",
              "minimum": 18,
              "description": "雇员年龄"
            }
          },
          "required": [
            "name",
            "age"
          ]
        }
      }
    }
```
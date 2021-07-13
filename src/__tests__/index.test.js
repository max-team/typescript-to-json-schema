/**
 * @file unit test
 * @author cxtom(cxtom2008@gmail.com)
 */

/* eslint-disable fecs-no-require */

const {
    readdirSync
} = require('fs-extra');
const {
    resolve,
    basename
} = require('path');
const {
    generateSchema,
    mergeSchemas
} = require('../index');

describe('typescript-json-schema', () => {

    const files = readdirSync(resolve(__dirname, 'fixtures'))
        .filter(n => n.includes('.ts'))
        .map(n => resolve(__dirname, 'fixtures', n));

    const {
        schemas
    } = generateSchema(files, {
        getId(filePath) {
            return basename(filePath, '.ts') + '.json';
        }
    });

    const image = schemas['image.json'];
    const company = schemas['company.json'];
    const support = schemas['support.json'];
    const namespace = schemas['namespace.json'];

    // console.log(JSON.stringify(image, null, 2));

    it('$schema & $id & $ref', function () {
        expect(image.$schema).toBe('http://json-schema.org/draft-07/schema#');
        expect(image.$id).toBe('http://www.baidu.com/schemas/image.json');
        expect(image.$ref).toBe('#/definitions/image');
    });

    it('definitions', function () {
        expect(Object.keys(image.definitions)).toEqual(['imagebase', 'timg', 'onlinecut', 'image']);
    });

    it('boolean & null', function () {
        expect(company.definitions.department.properties.open).toEqual({
            oneOf: [{
                type: 'boolean'
            }, {
                const: null
            }],
            description: '是否开始'
        });
    });

    // it('oneOf', function () {
    //     expect(image.definitions.timg.anyOf[1].properties.params.properties.cuttype).toEqual({
    //         oneOf: [{
    //                 type: 'integer',
    //                 minimum: 1,
    //                 maximum: 8,
    //                 default: 8
    //             },
    //             {
    //                 type: 'string',
    //                 pattern: '^([bpwhfu][\\\\d_]+|[1-8])$'
    //             }
    //         ],
    //         description: '图片裁剪参数，默认为8'
    //     });
    // });

    it('array', function () {

        expect(company.definitions.department.properties.employee).toEqual({
            type: 'array',
            items: {
                $ref: '#/definitions/employee'
            },
            maxItems: 1000,
            description: '员工'
        });

        expect(company.definitions.company.properties.departments.items).toEqual({
            $ref: '#/definitions/department'
        });

        expect(image.definitions.onlinecut.anyOf[1].properties.test).toEqual({
            type: 'array',
            items: {
                type: 'string'
            },
            description: "数组"
        });
    });

    it('literal', function () {
        const definitions = support.definitions;
        expect(definitions.hello).toEqual({ const: 'Hello' });
        expect(definitions.world).toEqual({ const: 'World' });
        expect(definitions.foo).toEqual({ const: 'Hello World!' });
    });

    it('record', function () {
        const properties = support.definitions.recordtest.properties;
        expect(properties.a).toEqual({
            type: 'object',
            propertyNames: {
                type: 'string'
            },
            additionalProperties: {
                type: 'string'
            }
        });
        expect(properties.b.propertyNames).toEqual({
            type: 'number'
        });
        expect(properties.c.propertyNames).toEqual({
            enum: ['a', 'b']
        });
        expect(properties.d.additionalProperties).toEqual({
            type: 'boolean'
        });
        expect(properties.e.additionalProperties).toEqual({
            type: 'number'
        });
        expect(properties.f.additionalProperties).toEqual({
            $ref: '#/definitions/testvalue'
        });
        expect(properties.g.additionalProperties).toEqual({});
    });

    it('pickomit', function () {
        const {pick, pickMulti, omit, omitMulti} = support.definitions.pickomit.properties;
        expect(pick).toEqual({
            type: 'object',
            properties: {
                name: {
                    type: 'number'
                }
            },
            required: ['name'],
            description: 'Pick'
        });
        expect(pickMulti).toEqual({
            type: 'object',
            properties: {
                name: {
                    type: 'number'
                },
                bool: {
                    type: 'boolean'
                }
            },
            required: ['name', 'bool'],
            description: 'pickMulti'
          });
        expect(omit).toEqual({
            type: 'object',
            properties: {
                test: {
                    type: 'string'
                },
                bool: {
                    type: 'boolean'
                }
            },
            required: ['test', 'bool']
        });
        expect(omitMulti).toEqual({
            type: 'object',
            properties: {
                test: {
                    type: 'string'
                }
            },
            required: ['test']
        });
    });

    it('namespace', function () {
        const {testnamespace, emptynamespace} = namespace.definitions;
        expect(testnamespace).toEqual({
            test: {
                type: 'object',
                properties: {
                    a: {
                        type: 'string'
                    }
                },
                required: ['a']
            },
            fooz: {
                type: 'object',
                properties: {
                    bar: {
                        type: 'number'
                    }
                },
                required: ['bar']
            }
        });
        expect(emptynamespace).toEqual({});
    });

    it('merge allOf', function () {

        const testSchemas = {
            a: {
                allOf: [
                    {
                        type: 'object',
                        properties: {
                            show: {
                                type: 'boolean'
                            }
                        },
                        allOf: [
                            {
                                if: {
                                    properties: {
                                        show: {
                                            const: true
                                        }
                                    }
                                },
                                then: {
                                    properties: {
                                        price: {
                                            type: 'string'
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        type: 'object',
                        properties: {
                            show: {
                                const: true
                            }
                        }
                    }
                ]
            }
        };

        const result = mergeSchemas(testSchemas, {
            mergeAllOf: true
        });

        expect(result.a.properties.show).toEqual({
            type: 'boolean',
            const: true
        });

        expect(result.a.allOf.length).toEqual(1);

    });
});
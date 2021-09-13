
const { Project } = require('ts-morph');
const { Translate } = require('../index');

describe('tranform', () => {

    it('project: internal', () => {
        const translate = new Translate();
        expect(translate.getProject()).toBeDefined();
    });

    it('project: external', () => {
        const project = new Project();
        const translate = new Translate({project});
        expect(translate.getProject()).toBe(project);
    });

    it('project: external incompatible', () => {
        expect(() => {
            new Translate({project: {}});
        }).toThrow();
    });

    it('schema: base type', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'BaseType'
        });
        expect(Object.keys(res.properties.str)).toEqual([
            'type', 'minLength', 'maxLength', 'pattern', 'format', 'description'
        ]);
        expect(Object.keys(res.properties.num)).toEqual([
            'type', 'minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum', 'multipleOf', 'description'
        ]);
        expect(Object.keys(res.properties.bool)).toEqual([
            'type', 'description'
        ]);
        expect(Object.keys(res.properties.arr)).toEqual([
            'type', 'items', 'minItems', 'maxItems', 'uniqueItems', 'description'
        ]);
        expect(Object.keys(res.properties.enum)).toEqual([
            '$ref', 'description'
        ]);
        expect(Object.keys(res.properties.enumUnion)).toEqual([
            'enum', 'description'
        ]);
        expect(Object.keys(res.properties.indexAccess)).toEqual([
            '$ref', 'description'
        ]);
        expect(res.definitions).toBeDefined();

        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.enum).toEqual(schema.properties.enumUnion);
    });

    it('schema: template literal', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'CompositionType'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.tplLiteral).toEqual({
            description: '模板字符串',
            const: 'Hello World!'
        });
    });

    it('schema: record', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'RecordSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.a).toEqual({
            type: 'object',
            propertyNames: { type: 'string' },
            additionalProperties: { type: 'string' }
        });
        expect(schema.properties.c.propertyNames).toEqual({
            enum: ['a', 'b']
        });
        expect(schema.properties.d.additionalProperties).toEqual({
            type: 'boolean'
        });
        expect(schema.properties.e.additionalProperties).toEqual({
            type: 'number'
        });
        expect(schema.properties.f.additionalProperties).toEqual({
            type: 'object',
            properties: {
                arr: {
                    type: 'array',
                    items: { type: 'number' }
                }
            },
            required: ['arr']
        });
        expect(schema.properties.g.additionalProperties).toBeUndefined();
    });

    it('schema: pick', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'PickSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(Object.keys(schema.properties.single.properties)).toEqual(['str']);
        expect(Object.keys(schema.properties.multi.properties)).toEqual(['str', 'num']);
    });

    it('schema: omit', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'OmitSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(Object.keys(schema.properties.single.properties)).not.toContain(['str']);
        expect(Object.keys(schema.properties.multi.properties)).not.toContain(['str', 'num']);
    });

    it('schema: generic', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'GenericTest'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.a).toEqual({
            type: 'object',
            properties: {
                type: { type: 'string' },
                data: {
                    type: 'object',
                    properties: {
                        arr: {
                            type: 'array',
                            items: { type: 'number' }
                        }
                    },
                    required: ['arr']
                }
            },
            required: ['data', 'type']
        });
        expect(schema.properties.b).toEqual({
            type: 'object',
            properties: {
                type: { enum: ['0', '1'] },
                data: {
                    type: 'object',
                    properties: {
                        arr: {
                            type: 'array',
                            items: { type: 'number' }
                        }
                    },
                    required: ['arr']
                }
            },
            required: ['data', 'type']
        });
    });

    it('schema: extends normal', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'ExtendSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties).toHaveProperty('str');
    });

    it('schema: extends ref', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'RefExtendSupprt'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.a.properties).toHaveProperty('str');
    });

    it('schema: oneOf', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'OneOfSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.anyof).toHaveProperty('oneOf');
    });

    it('schema: namespace', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/support.ts',
            nodeName: 'NameSpaceSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.a.properties.bar).toEqual({
            type: 'number'
        });
        expect(schema.properties.b.properties.bar).toEqual({
            type: 'string'
        });
    });

    it('schema: import & global', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/import.ts',
            nodeName: 'ImportSupport'
        });
        const schema = translate.mergeDefinitions(res);
        expect(schema.properties.a).toEqual({
            enum: [2, 3]
        });
        expect(schema.properties.b).toEqual({
            const: 'Hello World!'
        });
        expect(schema.properties.c).toEqual({
            type: 'object',
            properties: {
                arr: {
                    type: 'array',
                    items: { type: 'number' }
                }
            },
            required: ['arr']
        });

        const gtranslate = new Translate();
        const gres = gtranslate.generateSchema({
            filePath: './src/__tests__/translate/global.ts',
            nodeName: 'GlobalSupport'
        }, {
            globalFiles: ['./src/__tests__/translate/support.ts']
        });
        const gschema = gtranslate.mergeDefinitions(gres);
        expect(gschema).toEqual(schema);
    });

    it('schema: unsupport type', () => {
        const translate = new Translate();
        const res = translate.generateSchema({
            filePath: './src/__tests__/translate/global.ts',
            nodeName: 'UnSupportType'
        });
        expect(res.properties).not.toHaveProperty('a');
    });

});
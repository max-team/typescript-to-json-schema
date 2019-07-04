/**
 * @file ts -> schema generator
 * @author cxtom(cxtom2008@gmail.com)
 */

import { Project } from 'ts-morph';
import { basename } from 'path';

import { isPlainObject, get, omit, uniq, isArray } from 'lodash';

import {
    processInterface,
    processTypeAlias
} from './util';

/**
 * 内置类型：数字，或者可转为数字的字符串
 */
export type numberic = string | number;

/**
 * 内置类型：整型
 */
export type integer = number;


export interface GenerateSchemaOption {
    getId(filePath: string): string;
    tsConfigFilePath?: string;
    baseUrl?: string;
}

interface Schema {
    type?: string;
    anyOf?: Schema[];
    oneOf?: Schema[];
    $ref?: string;
    properties?: {
        [key: string]: Schema
    },
    required?: string[];
}

export function generateSchema(files: string[], options: GenerateSchemaOption): {schemas: {[id: string]: Schema}} {

    const {
        getId,
        tsConfigFilePath,
        baseUrl = 'http://www.baidu.com/schemas'
    } = options;

    const project = new Project({
        tsConfigFilePath
    });

    const state = {getId};

    const sourceFiles = project.addExistingSourceFiles(files);
    project.resolveSourceFileDependencies();

    const schemas: {[name: string]: object} = {};

    for (const sourceFile of sourceFiles) {

        const filePath = sourceFile.getFilePath();
        const fileName = basename(filePath, '.ts');
        let definitions: {[name: string]: object} = {};

        const interfaces = sourceFile.getInterfaces();
        definitions = interfaces.reduce(
            (prev, node) => ({
                ...prev,
                [node.getName().toLowerCase()]: processInterface(node, sourceFile, state)
            }),
            definitions
        );

        const typeAliases = sourceFile.getTypeAliases();
        definitions = typeAliases.reduce(
            (prev, node) => ({
                ...prev,
                [node.getName().toLowerCase()]: processTypeAlias(node, sourceFile, state)
            }),
            definitions
        );

        const id = getId(filePath);

        schemas[id] = {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            '$id': `${baseUrl}${baseUrl && !/\/$/.test(baseUrl) ? '/' : ''}${id}`,
            '$ref': `#/definitions/${fileName.toLowerCase()}`,
            definitions
        };
    }

    return {
        schemas
    };
}

interface SchemaList {
    [id: string]: Schema
}

export function mergeSchemas(schemas: SchemaList) {

    function mergeSchema(a: Schema, b: Schema): Schema {
        const ret = {...a, ...b};
        if (!b) {
            return ret;
        }
        if (a.type === 'object' || b.type === 'object') {
            ret.properties = {
                ...a.properties,
                ...b.properties
            };
            a.properties && Object.keys(a.properties).forEach(key => {
                if (b.properties[key]) {
                    ret.properties[key] = mergeSchema(a.properties[key], b.properties[key]);
                }
            });
            ret.required = uniq([...(a.required || []), ...(b.required || [])]);
        }
        return ret;
    }

    function getSchema(ref: string, id: string, schemas: SchemaList) {
        let [refId, pointer] = ref.split('#/');
        refId = refId || id;
        let ret = walk(get(schemas[refId], pointer.split('/')), refId, schemas);
        return ret;
    }

    function walk(element: Schema, id: string, schemas: SchemaList) {
        if (!element) {
            return;
        }
        let ret = {...element};
        if (element.$ref) {
            ret = mergeSchema(omit(element, '$ref'), getSchema(element.$ref, id, schemas));
        }
        if (element.anyOf) {
            console.log(walk(element.anyOf[0], id, schemas));
            ret = mergeSchema(omit(ret, 'anyOf'), walk(element.anyOf[0], id, schemas));
            for (let i = 1; i < element.anyOf.length; i++) {
                ret = mergeSchema(ret, walk(element.anyOf[i], id, schemas))
            }
        }
        for (const key in element) {
            if (ret.hasOwnProperty(key)) {
                if (isPlainObject(element[key])) {
                    ret[key] = walk(element[key], id, schemas);
                }
                if (isArray(element[key]) && ['oneOf', 'anyOf'].includes(key)) {
                    ret[key] = element[key].map(e => isPlainObject(e) && walk(e, id, schemas));
                }
            }
        }
        return ret;
    }

    const ret = {};

    for (const id in schemas) {
        if (schemas.hasOwnProperty(id)) {
            const element = schemas[id];
            ret[id] = walk(schemas[id], id, schemas);
            if (element.$ref) {
                delete ret[id].definitions;
            }
        }
    }

    return ret;
}
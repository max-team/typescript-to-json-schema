/**
 * @file ts -> schema generator
 * @author cxtom(cxtom2008@gmail.com)
 */

import { Project } from 'ts-morph';
import { basename } from 'path';

import { isPlainObject, get, omit, uniq, isArray } from 'lodash';

import {
    processInterface,
    processTypeAlias,
    Schema
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
    getRootName?: (filePath: string) => string;
    tsConfigFilePath?: string;
    baseUrl?: string;
}

export function generateSchema(files: string[], options: GenerateSchemaOption): {schemas: {[id: string]: Schema}} {

    const {
        getId,
        getRootName = filePath => basename(filePath, '.ts').toLowerCase(),
        tsConfigFilePath,
        baseUrl = 'http://www.baidu.com/schemas'
    } = options;

    const project = new Project({
        tsConfigFilePath
    });

    const state = { getId };

    const sourceFiles = project.addExistingSourceFiles(files);
    project.resolveSourceFileDependencies();

    const schemas: {[name: string]: object} = {};

    for (const sourceFile of sourceFiles) {

        const filePath = sourceFile.getFilePath();
        const rootName = getRootName(filePath);
        let definitions: {[name: string]: object} = {};

        try {
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
        }
        catch (e) {
            console.error(`${filePath} generate error! ${e.stack}`);
            return { schemas: {} };
        }

        if (Object.keys(definitions).length <= 0) {
            continue;
        }

        const id = getId(filePath);

        schemas[id] = {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            '$id': `${baseUrl}${baseUrl && !/\/$/.test(baseUrl) ? '/' : ''}${id}`,
            '$ref': definitions[rootName] ? `#/definitions/${rootName}` : undefined,
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

export function mergeSchemas(schemas: SchemaList, options?: { mergeAnyOf?: boolean }) {

    const { mergeAnyOf = true } = options;

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
            b.properties && a.properties && Object.keys(a.properties).forEach(key => {
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
        if (element.anyOf && mergeAnyOf) {
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
                if (isArray(element[key]) && ['oneOf', 'anyOf', 'allOf', 'items'].includes(key)) {
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
            try {
                ret[id] = walk(schemas[id], id, schemas);
            }
            catch (e) {
                console.error(`merge ${id} failed! ${e.stack}`);
            }
            if (element.$ref) {
                delete ret[id].definitions;
            }
        }
    }

    return ret;
}
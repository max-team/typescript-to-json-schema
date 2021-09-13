/**
 * @file ts -> schema generator
 * @author cxtom(cxtom2008@gmail.com)
 */

import { Project, SourceFile, ModuleDeclaration } from 'ts-morph';
import { basename } from 'path';

import { isPlainObject, get, omit, isArray } from 'lodash';

import {
    processInterface,
    processTypeAlias,
    processEnum,
    mergeSchema,
    Schema,
    PropIterator,
    CompilerState
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
    beforePropMount?: PropIterator;
    tsConfigFilePath?: string;
    baseUrl?: string;
}

function getDefinitions(sourceFile: SourceFile, state: CompilerState, namespace?: ModuleDeclaration) {
    const source = namespace || sourceFile;
    let definitions: {[name: string]: object} = {};

    const interfaces = source.getInterfaces();
    definitions = interfaces.reduce(
        (prev, node) => node.getTypeParameters().length > 0 ? prev : {
            ...prev,
            [node.getName().toLowerCase()]: processInterface(node, sourceFile, state)
        },
        definitions
    );

    const typeAliases = source.getTypeAliases();
    definitions = typeAliases.reduce(
        (prev, node) => ({
            ...prev,
            [node.getName().toLowerCase()]: processTypeAlias(node, sourceFile, state)
        }),
        definitions
    );

    const enums = source.getEnums();
    definitions = enums.reduce(
        (prev, node) => ({
            ...prev,
            [node.getName().toLowerCase()]: processEnum(node)
        }),
        definitions
    );

    return definitions;
}

export function generateSchema(files: string[], options: GenerateSchemaOption): {schemas: {[id: string]: Schema}} {

    const {
        getId,
        beforePropMount,
        getRootName = filePath => basename(filePath, '.ts').toLowerCase(),
        tsConfigFilePath,
        baseUrl = 'http://www.baidu.com/schemas'
    } = options;

    const project = new Project({
        tsConfigFilePath
    });

    const state = { getId, beforePropMount };

    const sourceFiles = project.addSourceFilesAtPaths(files);
    project.resolveSourceFileDependencies();

    const schemas: {[name: string]: object} = {};

    for (const sourceFile of sourceFiles) {

        const filePath = sourceFile.getFilePath();
        const rootName = getRootName(filePath);
        let definitions: {[name: string]: object} = {};

        try {
            const namespaces = sourceFile.getModules();
            definitions = namespaces.reduce(
                (prev, namespace) => ({
                    ...prev,
                    [namespace.getName().toLowerCase()]: getDefinitions(sourceFile, state, namespace)
                }),
                definitions
            );

            definitions = {
                ...definitions,
                ...getDefinitions(sourceFile, state)
            };
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

export function mergeSchemas(schemas: SchemaList, options: { mergeAnyOf?: boolean, mergeAllOf?: boolean }) {

    const {
        mergeAnyOf = true,
        mergeAllOf = true
    } = options;

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
            ret = mergeSchema(getSchema(element.$ref, id, schemas), omit(element, '$ref'));
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

        if (element.anyOf && mergeAnyOf) {
            ret = mergeSchema(omit(ret, 'anyOf'), walk(element.anyOf[0], id, schemas));
            for (let i = 1; i < element.anyOf.length; i++) {
                ret = mergeSchema(ret, walk(element.anyOf[i], id, schemas))
            }
        }

        if (element.allOf && mergeAllOf) {
            let hasIfThen = true;
            for (let i = 0; i < element.allOf.length; i++) {
                if (!element.allOf[i].if || !element.allOf[i].then) {
                    hasIfThen = false;
                    break;
                }
            }
            if (!hasIfThen) {
                const allOfArray = [ ...ret.allOf ];
                ret = omit(ret, 'allOf');
                for (let item of allOfArray) {
                    item = walk(item, id, schemas);
                    ret = mergeSchema(ret, item);
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

export { Schema, PropContext } from './util';
export * from './translate/types';
export { Translate } from './translate';

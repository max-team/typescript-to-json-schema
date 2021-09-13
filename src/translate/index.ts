/**
 * @file Translate
 * @author xuxiulou
 */

import { Project } from 'ts-morph';
import { set, get, isArray, omit, isPlainObject } from 'lodash';
import traverse from 'json-schema-traverse';

import { mergeSchema } from '../util';
import { Definition, REF_PREFIX } from './definition';
import { TransOption, EntryNode, GenOption, TansNode, CompositionSchema } from './types';

function mergeAnyOf(schema: CompositionSchema): CompositionSchema {
    const ret = {...schema};

    for (const key in ret) {
        if (!ret.hasOwnProperty(key)) {
            continue;
        }
        if (isPlainObject(ret[key])) {
            ret[key] = mergeAnyOf(ret[key]);
        }
    }

    if (isArray(ret.anyOf)) {
        let afschema = mergeAnyOf(ret.anyOf[0]);
        for (let i = 1; i < ret.anyOf.length; i++) {
            afschema = mergeSchema(afschema, mergeAnyOf(ret.anyOf[i]));
        }
        return Object.assign(omit(ret, 'anyOf'), afschema);
    }

    return omit(ret, 'anyOf');
}

export class Translate {

    readonly project: Project;

    constructor(opts?: TransOption) {
        const { project, tsConfigFilePath } = opts || {};

        if (project && !project.addSourceFileAtPath) {
            throw new Error('The version of ts-morph require 11.0.3+.');
        }

        this.project = project || new Project({
            tsConfigFilePath
        });
    }

    getProject() {
        return this.project;
    }

    generateSchema(entry: EntryNode, opts?: GenOption): CompositionSchema {
        const {filePath, nodeName} = entry || {};
        if (!filePath || !nodeName) {
            return;
        }
        const sourceFile = this.project.addSourceFileAtPath(filePath);
        const interfaceInst = sourceFile.getInterface(nodeName);
        if (!interfaceInst) {
            return;
        }
        
        let schema: CompositionSchema = {};
        const definitions = {};
        const definition = new Definition(this.project, opts);
        let transCache: TansNode[] = [];
        transCache.push({ node: interfaceInst.getNameNode(), root: schema, isRef: false });
        while (transCache.length > 0) {
            const { node, root, isRef, $ref: ref } = transCache.shift();
            const { $ref, schema, transList } = definition.generate(node, ref);
            if (!schema) {
                continue;
            }
            if (transList) {
                transCache = [...transCache, ...transList];
            }
            if (isRef && $ref) {
                set(definitions, $ref.split(REF_PREFIX)[1].split('/'), schema);
            }
            else {
                Object.assign(root, schema);
                delete root.$ref;
            }
        }

        schema = Object.keys(definitions).length === 0 ? schema : {
            ...schema,
            definitions
        };

        return {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            ...mergeAnyOf(schema)
        };
    }

    mergeDefinitions(schema: CompositionSchema): CompositionSchema {
        const { definitions } = schema;
        if (!definitions) {
            return schema;
        }
        traverse(schema, {
            cb: obj => {
                const { $ref } = obj;
                if (!$ref) {
                    return;
                }
                delete obj.$ref;
                Object.assign(obj, get(definitions, $ref.split(REF_PREFIX)[1].split('/')) || {});
            }
        });
        return omit(schema, 'definitions');
    }
}

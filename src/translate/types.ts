/**
 * @file type
 * @author xuxiulou
 */

import { Project, Identifier } from 'ts-morph';

import { Schema, PropIterator, PropContext } from '../util';

export interface TransOption {
    project?: Project;
    tsConfigFilePath?: string;
}

export interface EntryNode {
    filePath: string;
    nodeName: string;
}

export interface GenOption {
    globalFiles?: string[];
    beforePropMount?: PropIterator;
    afterPropMount?: (ctx: PropContext, schema: Schema) => void;
}

export interface TansNode {
    node: Identifier;
    root: Schema;
    isRef?: boolean;
    $ref?: string;
}

export interface TransResult {
    $ref: string;
    schema: Schema;
    transList?: TansNode[];
}

export interface CompositionSchema extends Schema {
    $schema?: string;
    $id?: string;
    definitions?: Schema;
}

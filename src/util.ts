/**
 * @file tool functions
 * @author cxtom(cxtom2008@gmail.com)
 */

import {
    JSDocableNode,
    InterfaceDeclaration,
    TypeLiteralNode,
    TypeNode,
    ts,
    TypeReferenceNode,
    Identifier,
    UnionTypeNode,
    TypeGuards,
    SourceFile,
    TypeAliasDeclaration,
    ArrayTypeNode,
    LiteralTypeNode,
    IndexedAccessTypeNode
} from "ts-morph";

import { omit } from 'lodash';

const buildTypes = new Set(['integer', 'numberic']);

export interface CompilerState {
    getId(filePath: string): string;
}

export function getDescription (node: JSDocableNode) {
    const jsdocs = node.getJsDocs();
    if (jsdocs.length > 0) {
        return jsdocs[0].getComment();
    }
}

export function getRequired (node: InterfaceDeclaration | TypeLiteralNode): string[] | undefined {
    const required = node.getProperties()
        .filter(n => !n.getQuestionTokenNode())
        .map(n => n.getName());
    if (required.length > 0) {
        return required;
    }
}

const getLiteralTypeValue = (node: LiteralTypeNode) => {
    const text = node.getText();
    return JSON.parse(/^'/.test(text) ? text.replace(/"/g, '\\"').replace(/(^'|'$)/g, '"').replace(/\\'/g, '\'') : text);
};

export function getTypeNodeSchema (node: TypeNode, sourceFile: SourceFile, state: CompilerState): object | undefined {
    switch (node.getKind()) {
        case ts.SyntaxKind.LiteralType:
            return { const: JSON.parse(node.getText()) };
        case ts.SyntaxKind.StringKeyword:
        case ts.SyntaxKind.NumberKeyword:
        case ts.SyntaxKind.BooleanKeyword:
        case ts.SyntaxKind.NullKeyword:
            return {
                type: node.getText()
            };
        case ts.SyntaxKind.TypeLiteral:
            return {
                type: 'object',
                properties: getProperties(node as TypeLiteralNode, sourceFile, state),
                required: getRequired(node as TypeLiteralNode)
            };
        case ts.SyntaxKind.TypeReference: {
            const text = node.getText();
            if (buildTypes.has(text)) {
                const isInterger = text === 'integer';
                return {
                    type: isInterger ? text : 'string',
                    format: isInterger ? undefined : text
                };
            } else {
                return getRef((node as TypeReferenceNode).getTypeName() as Identifier, sourceFile, state);
            }
        }
        case ts.SyntaxKind.UnionType: {
            const types = (node as UnionTypeNode).getTypeNodes();
            if (types.every(t => TypeGuards.isLiteralTypeNode(t))) {
                return {
                    enum: types.map(getLiteralTypeValue)
                };
            }
            return {
                oneOf: types.map(t => getTypeNodeSchema(t, sourceFile, state))
            };
        }
        case ts.SyntaxKind.ArrayType: {
            return {
                type: 'array',
                items: getTypeNodeSchema((node as ArrayTypeNode).getElementTypeNode(), sourceFile, state)
            };
        }
        case ts.SyntaxKind.IndexedAccessType: {
            const objectType = (node as IndexedAccessTypeNode).getObjectTypeNode();
            let accesses = [(node as IndexedAccessTypeNode).getIndexTypeNode()] as LiteralTypeNode[];
            let identifier = objectType
            while (TypeGuards.isIndexedAccessTypeNode(objectType)) {
                identifier = objectType.getObjectTypeNode();
                accesses.push(objectType.getIndexTypeNode() as LiteralTypeNode)
            }
            // @ts-ignore
            const { $ref } = getTypeNodeSchema(identifier, sourceFile, state);
            return {
                $ref: `${$ref}${accesses.map(a => '/properties/' + getLiteralTypeValue(a))}`
            };
        }
        default:
            return {};
    }
}

function getTagValue(tag, type: 'string' | 'number' | 'boolean'): boolean | number | string | {$data: string}  {
    if (/^\$\{(.*)\}$/.test(tag)) {
        return {
            $data: RegExp.$1
        };
    }
    if (type === 'number') {
        return Number(tag);
    }
    if (type === 'boolean') {
        return tag !== 'false';
    }
    return tag;
}

function mergeTags (schema?: {[name: string]: any}, tags: {[name: string]: any} = {}): object {
    const mergedSchema = { ...schema };
    if (mergedSchema.oneOf) {
        mergedSchema.oneOf = mergedSchema.oneOf.map(s => mergeTags(s, tags));
    }
    const numberAttrs = ['minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum', 'default', 'example'];
    const stringAttrs = ['minLength', 'maxLength', 'pattern', 'format', 'default', 'example'];
    const arrayAttrs = ['minItems', 'maxItems', 'uniqueItems'];
    if (['integer', 'number'].indexOf(mergedSchema.type) >= 0) {
        numberAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], 'number');
                name === 'default' && delete tags[name];
            }
        });
    }
    if (mergedSchema.type === 'string') {
        stringAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], ['minLength', 'maxLength'].includes(name) ? 'number' : 'string');
            }
        });
    }
    if (mergedSchema.type === 'array') {
        arrayAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], name === 'uniqueItems' ? 'boolean' : 'number');
            }
        });
    }
    if (mergedSchema.type === 'string' && mergedSchema.format === 'numberic') {
        numberAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], 'string');
            }
        });
    }
    if (tags.enumNames) {
        tags.enumNames = JSON.parse(tags.enumNames);
    }
    if (tags.enumName) {
        tags.enumName = JSON.parse(tags.enumName);
    }
    return { ...mergedSchema, ...omit(tags, [...numberAttrs, ...stringAttrs, ...arrayAttrs]) };
}

export function getProperties (node: InterfaceDeclaration | TypeLiteralNode, sourceFile: SourceFile, state: CompilerState): object {
    return node.getProperties().reduce((prev, property) => {
        const name = property.getName();
        const typeNode = property.getTypeNodeOrThrow();
        const tags = getJsDocTags(property);
        if ('ignore' in tags) {
            return prev;
        }
        const schema = mergeTags(getTypeNodeSchema(typeNode, sourceFile, state), tags);
        return {
            ...prev,
            [name]: {
                ...schema,
                description: getDescription(property)
            }
        };
    }, {});
}

export function getRef (identifier: Identifier, sourceFile: SourceFile, state: CompilerState) {
    const definitions = identifier.getDefinitions();
    const file = definitions[0].getSourceFile();
    let id = '';
    if (file.getFilePath() !== sourceFile.getFilePath()) {
        id = state.getId(file.getFilePath());
    }
    return { $ref: `${id}#/definitions/${identifier.getText().toLowerCase()}` };
}

function getJsDocTags(node: JSDocableNode) {
    return node.getJsDocs().reduce((prev, jsdoc) => {
        return {
            ...prev,
            ...jsdoc.getTags().reduce((p, v) => ({ ...p, [v.getTagName()]: v.getComment() }), {})
        };
    }, {});
}


/**
 * 生成 definitions
 *
 * @param node 节点
 */
export function processInterface (node: InterfaceDeclaration, sourceFile: SourceFile, state: CompilerState) {

    const exts = node.getExtends().map(e => {
        return getRef(e.getExpression() as Identifier, sourceFile, state);
    });

    const tags = getJsDocTags(node);

    const base = mergeTags({
        type: 'object',
        properties: getProperties(node, sourceFile, state),
        required: getRequired(node),
        description: getDescription(node)
    }, tags);

    const schema = exts.length > 0 ? {
        anyOf: [...exts, base]
    } : base;

    return {
        ...schema
    };
}

export function processTypeAlias (node: TypeAliasDeclaration, sourceFile: SourceFile, state: CompilerState) {
    const typeNode = node.getTypeNode();
    const tags = getJsDocTags(node);
    const schema = mergeTags(getTypeNodeSchema(typeNode, sourceFile, state), tags);
    return schema;
}

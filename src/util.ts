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

interface ObjectProperties {
    [key: string]: Schema;
}

export interface Schema {
    type?: string;
    anyOf?: Schema[];
    allOf?: Schema[];
    oneOf?: Schema[];
    $ref?: string;
    properties?: ObjectProperties,
    required?: string[];
    const?: string | boolean | number;
    format?: string;
    enum?: (string | number)[];
    items?: Schema;
    if?: Schema,
    then?: Schema
}

export function getDescription (node: JSDocableNode) {
    const jsdocs = node.getJsDocs();
    if (jsdocs.length > 0) {
        const des = jsdocs[0].getComment();
        return des && des.trim() ? des.trim() : undefined;
    }
}

export function getRequired (node: InterfaceDeclaration | TypeLiteralNode): string[] | undefined {
    const required = node.getProperties()
        .filter(n => !n.getQuestionTokenNode() && !('ignore' in getJsDocTags(n)))
        .map(n => n.getName());
    if (required.length > 0) {
        return required;
    }
}

const getLiteralTypeValue = (node: LiteralTypeNode) => {
    const text = node.getText();
    return JSON.parse(/^'/.test(text) ? text.replace(/"/g, '\\"').replace(/(^'|'$)/g, '"').replace(/\\'/g, '\'') : text);
};

export function getTypeNodeSchema (node: TypeNode, sourceFile: SourceFile, state: CompilerState): Schema {
    switch (node.getKind()) {
        case ts.SyntaxKind.LiteralType:
            return { const: getLiteralTypeValue(node as LiteralTypeNode) };
        case ts.SyntaxKind.StringKeyword:
        case ts.SyntaxKind.NumberKeyword:
        case ts.SyntaxKind.BooleanKeyword:
        case ts.SyntaxKind.NullKeyword:
        case ts.SyntaxKind.ObjectKeyword:
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
            const name = (node as TypeReferenceNode).getTypeName().getText();
            if (buildTypes.has(text)) {
                const isInterger = text === 'integer';
                return {
                    type: isInterger ? text : 'string',
                    format: isInterger ? undefined : text
                };
            }
            else if (name === 'Array') {
                return {
                    type: 'array',
                    items: getTypeNodeSchema((node as TypeReferenceNode).getTypeArguments()[0], sourceFile, state)
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
        case ts.SyntaxKind.IntersectionType: {
            const types = (node as UnionTypeNode).getTypeNodes();
            return {
                allOf: types.map(t => getTypeNodeSchema(t, sourceFile, state))
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
    if (mergedSchema.allOf) {
        mergedSchema.allOf = mergedSchema.allOf.map(s => mergeTags(s, tags));
    }
    const changeAttrs = ['default', 'example'];
    const numberAttrs = ['minItems', 'maxItems', 'minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum', 'minLength', 'maxLength'];
    const booleanAttrs = ['uniqueItems', 'flatten'];
    if (['integer', 'number'].indexOf(mergedSchema.type) >= 0) {
        changeAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], 'number');
                name === 'default' && delete tags[name];
            }
        });
    }
    if (mergedSchema.type === 'string') {
        changeAttrs.forEach(name => {
            if (tags[name] != null) {
                mergedSchema[name] = getTagValue(tags[name], 'string');
            }
        });
    }
    numberAttrs.forEach(name => {
        if (tags[name] != null) {
            mergedSchema[name] = getTagValue(tags[name], 'number');
        }
    });
    booleanAttrs.forEach(name => {
        if (tags[name] != null) {
            mergedSchema[name] = getTagValue(tags[name], 'boolean');
        }
    });
    const jsonAttrs = ['enumNames', 'enumName', 'dataSchemaRequired', 'opencardDataSchemaRequired'];
    for (const attr of jsonAttrs) {
        if (tags[attr] != null) {
            tags[attr] = JSON.parse(tags[attr]);
        }
    }
    if (mergedSchema.$ref && !mergedSchema.type) {
        return { ...mergedSchema, ...tags }
    }
    return {
        ...mergedSchema,
        ...omit(tags, [
            ...jsonAttrs,
            ...numberAttrs,
            ...booleanAttrs,
            ...changeAttrs
        ])
    };
}

export function getProperties (node: InterfaceDeclaration | TypeLiteralNode, sourceFile: SourceFile, state: CompilerState): ObjectProperties {
    return node.getProperties().reduce((prev, property) => {
        const name = property.getName();
        const typeNode = property.getTypeNodeOrThrow();
        let tags = getJsDocTags(property);
        // 忽略
        if ('ignore' in tags) {
            return prev;
        }
        const typeSchema = getTypeNodeSchema(typeNode, sourceFile, state);
        const schema = mergeTags(typeSchema, tags);
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
    return {
        ...schema,
        description: getDescription(node)
    };
}

/**
 * @file Definition
 * @author xuxiulou
 */

import crypto from 'crypto';
import chalk from 'chalk';
import { set, get, omitBy, isNil, pick, omit, intersection } from 'lodash';
import traverse from 'json-schema-traverse';

import {
    Project,
    ts,
    Identifier,
    InterfaceDeclaration,
    PropertyAccessExpression,
    QualifiedName,
    TypeLiteralNode,
    TypeNode,
    SourceFile,
    LiteralTypeNode,
    TemplateLiteralTypeNode,
    TypeReferenceNode,
    UnionTypeNode,
    TypeGuards,
    ArrayTypeNode,
    IndexedAccessTypeNode,
    TypeAliasDeclaration,
    EnumDeclaration,
    ModuleDeclaration
} from 'ts-morph';

import {
    getJsDocTags,
    mergeTags,
    getRequired,
    getDescription,
    getInterface,
    getLiteralTypeValue,
    Schema
} from '../util';

import { TransResult, TansNode, GenOption } from './types';

function getId(filePath) {
    const md5 = crypto.createHash('md5');
    return md5.update(filePath).digest('hex');
}

function isTsLibPath(filePath: string) {
    return filePath.includes('/node_modules/typescript/lib/');
}

function checkRecursion(node: TypeReferenceNode) {
    const name = node.getText();
    const sourceFile = node.getSourceFile();
    let recursion = false;
    let tmpNode = node.getParent();
    while (tmpNode) {
        if (tmpNode.getKind() !== ts.SyntaxKind.PropertySignature
            && tmpNode.getSymbol()?.getName() === name
            && tmpNode.getSourceFile() === sourceFile
        ) {
            recursion = true;
            break;
        }
        tmpNode = tmpNode.getParent();
    }
    return recursion;
}

export const REF_PREFIX = '#/definitions/';

export class Definition {

    readonly defCache = {};
    readonly state: GenOption;

    readonly project: Project;

    transList: TansNode[] = [];

    constructor(project: Project, opts?: GenOption) {
        this.state = opts || {};
        this.project = project;
    }

    generate(identifier: Identifier, ref?: string): TransResult {
        const $ref = ref || this.getRef(identifier);
        if (!$ref) {
            return { $ref, schema: null };
        }

        const path = $ref.split(REF_PREFIX)[1].split('/');
        const cacheSchema = get(this.defCache, path);
        if (cacheSchema) {
            return { $ref, schema: {...cacheSchema} };
        }

        this.resetTransList();
        const schema = this.getReferenceSchema(identifier);
        set(this.defCache, path, schema);
        return { $ref, schema, transList: [...this.transList] };
    }

    private getReferenceSchema(identifier: Identifier): Schema {
        const declaration = identifier.getSymbol().getDeclarations()[0];
        switch (declaration.getKind()) {
            // 外部导入类型
            case ts.SyntaxKind.ImportClause:
            case ts.SyntaxKind.ImportSpecifier: {
                const sourceFile = identifier.getDefinitions()[0].getSourceFile();
                const node = this.getSourceFileNode(sourceFile, identifier.getText());
                if (node) {
                    return this.getReferenceSchema(node.getNameNode());
                }
                return {};
            }
            // 内部 Interface
            case ts.SyntaxKind.InterfaceDeclaration: {
                return this.processInterface(declaration as InterfaceDeclaration);
            }
            // 内部 TypeAlias
            case ts.SyntaxKind.TypeAliasDeclaration: {
                const typeNode = (declaration as TypeAliasDeclaration).getTypeNode();
                return this.getTypeNodeSchema(typeNode, typeNode.getSourceFile());
            }
            // 内部 Enum
            case ts.SyntaxKind.EnumDeclaration:
                return { enum: (declaration as EnumDeclaration).getMembers().map(member => member.getValue()) };
            default:
                return {};
        }
    }

    private processInterface(node: InterfaceDeclaration): Schema {    
        let exts = [];
        if (node.getKind() === ts.SyntaxKind.InterfaceDeclaration) {
            exts = node.getExtends().map(e => this.getSchemaAsync(e.getExpression() as Identifier, false));
        }
    
        const tags = getJsDocTags(node);
        const properties = this.getProperties(node, node.getSourceFile());
        const required = getRequired(node);
        let base = mergeTags({
            type: 'object',
            properties,
            required: intersection(required, Object.keys(properties)),
            description: getDescription(node)
        }, tags);

        base = omitBy(base, isNil);

        return exts.length > 0 ? {
            anyOf: [...exts, base]
        } : base;
    }

    private getProperties(node: InterfaceDeclaration | TypeLiteralNode, sourceFile: SourceFile): Record<string, Schema> {
        return node.getProperties().reduce((prev, property) => {
            const name = property.getName();
            const typeNode = property.getTypeNodeOrThrow();
            let tags = getJsDocTags(property);
            // 忽略
            if ('ignore' in tags) {
                return prev;
            }
            let typeSchema = null;
            try {
                typeSchema = this.getTypeNodeSchema(typeNode, sourceFile);
            } catch(err) {
                const {line, column} = sourceFile.getLineAndColumnAtPos(typeNode.getStart());
                const msg = 'Get schema failed! Ignore this property.';
                console.log(`${
                    chalk.yellow('WARNING')
                } ${sourceFile.getFilePath()}\n${chalk.cyan(`line ${line}, col ${column}`)} ${msg}`);
                return prev;
            }
            if (!typeSchema) {
                return prev;
            }
            const schema = Object.assign(typeSchema, mergeTags(typeSchema, tags));
            const description = getDescription(property);
            if (description) {
                Object.assign(typeSchema, { description });
            }
            
            const {beforePropMount, afterPropMount, plugins} = this.state;
            const propContext = {
                property,
                typeNode,
                interface: node as InterfaceDeclaration,
                sourceFile
            };
            if (beforePropMount) {
                const {ignore} = beforePropMount(propContext, schema) || {};
                if (ignore) {
                    return prev;
                }
            }
            afterPropMount && afterPropMount(propContext, schema);
            plugins && plugins.forEach(plugin => plugin.traverse && plugin.traverse(propContext, {...schema}));

            return {
                ...prev,
                [name]: schema
            };
        }, {});
    }

    private getTypeNodeSchema(node: TypeNode, sourceFile: SourceFile): Schema {
        switch (node.getKind()) {
            case ts.SyntaxKind.LiteralType:
                return { const: getLiteralTypeValue(node as LiteralTypeNode) };
            case ts.SyntaxKind.TemplateLiteralType:
                return { const: JSON.parse((node as TemplateLiteralTypeNode).getType().getText()) };
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
                    properties: this.getProperties(node as TypeLiteralNode, sourceFile),
                    required: getRequired(node as TypeLiteralNode)
                };
            case ts.SyntaxKind.TypeReference: 
                return this.getTypeReferenceSchema(node as TypeReferenceNode, sourceFile);
            case ts.SyntaxKind.UnionType: {
                const types = (node as UnionTypeNode).getTypeNodes();
                if (types.every(t => TypeGuards.isLiteralTypeNode(t))) {
                    return {
                        enum: types.map(getLiteralTypeValue)
                    };
                }
                return {
                    oneOf: types.map(t => this.getTypeNodeSchema(t, sourceFile))
                };
            }
            case ts.SyntaxKind.IntersectionType: {
                const types = (node as UnionTypeNode).getTypeNodes();
                return {
                    allOf: types.map(t => this.getTypeNodeSchema(t, sourceFile))
                };
            }
            case ts.SyntaxKind.ArrayType: {
                return {
                    type: 'array',
                    items: this.getTypeNodeSchema((node as ArrayTypeNode).getElementTypeNode(), sourceFile)
                };
            }
            case ts.SyntaxKind.IndexedAccessType: {
                const objectType = (node as IndexedAccessTypeNode).getObjectTypeNode();
                let accesses = [(node as IndexedAccessTypeNode).getIndexTypeNode()] as LiteralTypeNode[];
                let identifier = objectType;
                while (TypeGuards.isIndexedAccessTypeNode(objectType)) {
                    identifier = objectType.getObjectTypeNode();
                    accesses.push(objectType.getIndexTypeNode() as LiteralTypeNode)
                }
                // @ts-ignore
                const { $ref } = this.getTypeNodeSchema(identifier, sourceFile);
                return {
                    $ref: `${$ref}${accesses.map(a => '/properties/' + getLiteralTypeValue(a))}`
                };
            }
            default:
                return;
        }
    }

    private getTypeReferenceSchema(node: TypeReferenceNode, sourceFile: SourceFile): Schema {
        const text = node.getText();
        const identifier = node.getTypeName() as Identifier;
        const name = identifier.getText();
        if (['integer', 'numberic'].includes(text)) {
            const isInterger = text === 'integer';
            return {
                type: isInterger ? text : 'string',
                format: isInterger ? undefined : text
            };
        }

        // 不规范写法兼容
        if (name === 'String') {
            return { type: 'string' };
        }
        if (name === 'Object') {
            return { type: 'object' };
        }

        if (name === 'Array') {
            return {
                type: 'array',
                items: this.getTypeNodeSchema(node.getTypeArguments()[0], sourceFile)
            };
        }
    
        const typeArgs = node.getTypeArguments();
        if (name === 'Record') {
            return {
                type: 'object',
                propertyNames: this.getTypeNodeSchema(typeArgs[0], sourceFile),
                additionalProperties: this.getTypeNodeSchema(typeArgs[1], sourceFile)
            };
        }
        if (['Pick', 'Omit'].includes(name)) {
            const schema = this.processInterface(
                getInterface((typeArgs[0] as TypeReferenceNode).getTypeName() as Identifier)
            );
            const {const: constVal, enum: enumVal} = this.getTypeNodeSchema(typeArgs[1], sourceFile);
            const propNames = constVal ? [constVal] : enumVal;
            return {
                type: 'object',
                properties: (name === 'Pick' ? pick : omit)(schema.properties, propNames),
                required: (schema.required || []).filter(itm => {
                    const res = propNames.includes(itm);
                    return name === 'Pick' ? res : !res;
                })
            }
        }

        // 视为泛型
        if (typeArgs.length > 0) {
            const typeMaps = typeArgs.map(typeNode => this.getTypeNodeSchema(typeNode, sourceFile));
            const genDec = getInterface(identifier);
            const relMap = genDec.getTypeParameters().reduce((prev, typeNode, idx) => {
                prev[`${REF_PREFIX}${typeNode.getName().toLowerCase()}`] = typeMaps[idx];
                return prev;
            }, {});
            const schema = this.processInterface(getInterface(identifier));
            traverse(schema, {
                cb: function (obj, jsonPointer, rootSchema) {
                    const {$ref} = obj;
                    if ($ref && relMap[$ref]) {
                        delete obj.$ref;
                        set(rootSchema, jsonPointer.slice(1).split('/'), Object.assign(relMap[$ref], obj));
                    }
                }
            });
            return schema;
        }

        // 全局声明处理
        if (!identifier.getSymbol()) {
            const node = this.getNodeFromGlobalFiles(identifier.getText());
            return node ? this.getSchemaAsync(node.getNameNode()) : undefined;
        }

        // 泛型参数直接返回 ref
        const declaration = identifier.getSymbol().getDeclarations()[0];
        if (declaration.getKind() === ts.SyntaxKind.TypeParameter) {
            return { $ref: `${REF_PREFIX}${identifier.getText().toLowerCase()}` };
        }

        // 未支持 TS 类型忽略
        if (isTsLibPath(declaration.getSourceFile().getFilePath())) {
            return;
        }

        // 递归引用忽略
        if (checkRecursion(node)) {
            return;
        }

        return this.getSchemaAsync(identifier);
    }

    private getNodeFromGlobalFiles(nodeName: string) {
        const { globalFiles } = this.state;
        if (!globalFiles || globalFiles.length === 0) {
            return;
        }
        for(let i = globalFiles.length - 1; i >= 0; i--) {
            const sourceFile = this.project.addSourceFileAtPath(globalFiles[i]);
            const node = this.getSourceFileNode(sourceFile, nodeName);
            if (node) {
                return node;
            }
        }
    }

    private getSourceFileNode(sourceFile: SourceFile, nodeName: string) {
        let target: SourceFile | ModuleDeclaration = sourceFile;
        let names = nodeName.split('.');
        while (names.length > 1) {
            const spaceName = names.splice(0, 1)[0];
            target = target.getModule(spaceName);
        }
        const name = names[0];
        return target.getInterface(name) || target.getEnum(name) || target.getTypeAlias(name);
    }

    private resetTransList() {
        this.transList = [];
    }

    private getSchemaAsync(identifier: Identifier, isRef: boolean = true): Schema {
        const $ref = this.getRef(identifier);
        const schema = { $ref };
        this.transList.push({ node: identifier, root: schema, isRef, $ref });
        return schema;
    }

    private getRef(node: Identifier | PropertyAccessExpression | QualifiedName) {
        const defArr: Identifier[] = [];
        if (node.getKind() === ts.SyntaxKind.PropertyAccessExpression) {
            let expNode = node as PropertyAccessExpression;
            while(expNode.getKind() === ts.SyntaxKind.PropertyAccessExpression) {
                defArr.unshift(expNode.getNameNode());
                expNode = expNode.getExpression() as PropertyAccessExpression;
            }
            defArr.unshift(expNode as unknown as Identifier);
        }
        else if (node.getKind() === ts.SyntaxKind.QualifiedName) {
            let expNode = node as QualifiedName;
            while(expNode.getKind() === ts.SyntaxKind.QualifiedName) {
                defArr.unshift(expNode.getRight());
                expNode = expNode.getLeft() as QualifiedName;
            }
            defArr.unshift(expNode as unknown as Identifier);
        }
        else {
            defArr.push(node as Identifier);
        }
    
        // 全局声明
        if (defArr[0].getDefinitions().length === 0) {
            const node = this.getNodeFromGlobalFiles(defArr[0].getText());
            if (!node) {
                return;
            }
            const subPath = node.getText().toLowerCase().split('.').join('/');
            return `${REF_PREFIX}${getId(node.getSourceFile().getFilePath())}/${subPath}`;
        }
    
        let file = null;
        const defNames = defArr.reduce((prev, def) => {
            const definitions = def.getDefinitions();
            file = definitions[0].getSourceFile();
            prev.push(definitions[0].getName().toLowerCase());
            return prev;
        }, []);
        return `${REF_PREFIX}${getId(file.getFilePath())}/${defNames.join('/')}`;
    }
}

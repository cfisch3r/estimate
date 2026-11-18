import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { diffExports, type ExportDiff } from './reviewExports.ts'
import { matchesPattern } from './reviewFloor.ts'

// The import edges of the changeset map: which project file imports which, before and after
// the change. Each side is a TypeScript program over a tree of files: the working tree, or
// the base commit read from git into memory, so no second checkout is needed. Every imported
// name is followed to the file that declares it, so a barrel never stands between two files.

/** The files of one side of the change, by repository path. */
export interface SourceTree {
  files: string[]
  read(path: string): string | undefined
}

/** One file importing names declared in another; `*` for an `export *`. */
export interface ImportEdge {
  from: string
  to: string
  names: string[]
  /** The names on this edge the file only re-exports, never imports for itself. */
  reexports?: string[]
}

/** A top-level declaration: its text without comments or formatting, and what it uses. */
export interface Declaration {
  text: string
  /** The keys of the other top-level declarations of the same file it refers to. */
  deps: string[]
}

/** What one file exports and declares. */
export interface FileFacts {
  /** Export name → the key of its declaration in this file, or null for a re-export. */
  exports: Record<string, string | null>
  /** Declaration key (its declared names, sorted and joined by `,`) → the declaration. */
  declarations: Record<string, Declaration>
  /** The file's leading doc comment, as one line. */
  doc?: string
}

/** One side of the change: the import edges and every project file's facts. */
export interface ProgramFacts {
  edges: ImportEdge[]
  files: Record<string, FileFacts>
}

export type ImportStatus = 'added' | 'removed' | 'kept'

export interface ImportChange extends ImportEdge {
  status: ImportStatus
}

// Paths in the program are the repository paths with a leading slash.
const ROOT = '/'
const abs = (path: string) => `${ROOT}${path}`
const rel = (fileName: string) => fileName.slice(ROOT.length)

function hostFor(tree: SourceTree): ts.CompilerHost {
  const known = new Set(tree.files)
  const dirs = new Set<string>()
  for (const file of tree.files) {
    const parts = file.split('/')
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  }
  const read = (fileName: string) =>
    known.has(rel(fileName)) ? tree.read(rel(fileName)) : undefined
  return {
    getSourceFile: (fileName, language) => {
      const text = read(fileName)
      return text === undefined
        ? undefined
        : ts.createSourceFile(fileName, text, language)
    },
    getDefaultLibFileName: () => abs('lib.d.ts'),
    writeFile: () => {},
    getCurrentDirectory: () => ROOT,
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (fileName) => known.has(rel(fileName)),
    readFile: read,
    directoryExists: (dir) => dir === ROOT || dirs.has(rel(dir).replace(/\/$/, '')),
    getDirectories: (dir) => {
      const prefix = rel(dir).replace(/\/$/, '')
      return [...dirs]
        .filter((d) => d.startsWith(prefix === '' ? '' : `${prefix}/`) && d !== prefix)
        .map((d) => d.slice(prefix === '' ? 0 : prefix.length + 1))
        .filter((d) => !d.includes('/'))
    },
    getEnvironmentVariable: () => undefined,
  }
}

/** The project's files by the configuration's include and exclude lists. */
function projectFiles(tree: SourceTree, configPath: string): ts.ParsedCommandLine {
  const text = tree.read(configPath)
  if (text === undefined) throw new Error(`${configPath} not found`)
  const { config, error } = ts.parseConfigFileTextToJson(abs(configPath), text)
  if (error)
    throw new Error(
      `${configPath}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`,
    )
  const matches = (path: string, spec: string) => {
    const pattern = spec.replace(/^\.\//, '')
    return /[*?]/.test(pattern)
      ? matchesPattern(path, pattern)
      : path === pattern || path.startsWith(`${pattern.replace(/\/$/, '')}/`)
  }
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    fileExists: (fileName) => tree.files.includes(rel(fileName)),
    readFile: (fileName) => tree.read(rel(fileName)),
    readDirectory: (_root, extensions, excludes, includes) =>
      tree.files
        .filter((f) => extensions.some((ext) => f.endsWith(ext)))
        .filter((f) => (includes ?? ['**/*']).some((spec) => matches(f, spec)))
        .filter((f) => !(excludes ?? []).some((spec) => matches(f, spec)))
        .map(abs),
  }
  const dir = configPath.includes('/')
    ? configPath.slice(0, configPath.lastIndexOf('/'))
    : ''
  return ts.parseJsonConfigFileContent(config, host, abs(dir), undefined, abs(configPath))
}

const byPair = (a: ImportEdge, b: ImportEdge) =>
  a.from.localeCompare(b.from) || a.to.localeCompare(b.to)

/** The import edges between the project's files, each to the file that declares the name. */
export function importEdges(tree: SourceTree, configPath: string): ImportEdge[] {
  return programFacts(tree, configPath).edges
}

/** The names a top-level statement declares; `default` for an anonymous default export. */
function declaredNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) {
    const names: string[] = []
    const collect = (name: ts.BindingName) => {
      if (ts.isIdentifier(name)) names.push(name.text)
      else
        for (const element of name.elements)
          if (!ts.isOmittedExpression(element)) collect(element.name)
    }
    for (const declaration of statement.declarationList.declarations)
      collect(declaration.name)
    return names
  }
  if (ts.isExportAssignment(statement)) return ['default']
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    return statement.name && ts.isIdentifier(statement.name)
      ? [statement.name.text]
      : ['default']
  }
  return []
}

/** A node's tokens joined by single spaces: comments, doc comments and layout left out. */
function tokens(node: ts.Node, source: ts.SourceFile): string {
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode)
      return
    const children = n.getChildren(source)
    if (children.length === 0) out.push(n.getText(source))
    else children.forEach(walk)
  }
  walk(node)
  return out.filter(Boolean).join(' ')
}

const keyOf = (statement: ts.Statement) => [...declaredNames(statement)].sort().join(',')

/** The first `/** *\/` comment before the file's first statement, as one line. */
function leadingDoc(source: ts.SourceFile): string | undefined {
  const text = source.getFullText()
  const range = (ts.getLeadingCommentRanges(text, 0) ?? []).find((r) =>
    text.startsWith('/**', r.pos),
  )
  if (!range) return undefined
  const doc = text
    .slice(range.pos + 3, range.end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
  return doc === '' ? undefined : doc
}

/** The import edges and each project file's exports and declarations. */
export function programFacts(tree: SourceTree, configPath: string): ProgramFacts {
  const parsed = projectFiles(tree, configPath)
  // Only the edges are needed, not a type check: no default library, no global types.
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noLib: true,
    types: [],
    noEmit: true,
  }
  const program = ts.createProgram(parsed.fileNames, options, hostFor(tree))
  const checker = program.getTypeChecker()
  const project = new Set(parsed.fileNames)

  const declaredIn = (symbol: ts.Symbol | undefined): string | undefined => {
    if (!symbol) return undefined
    const target =
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const file = target.declarations?.[0]?.getSourceFile().fileName
    return file && project.has(file) ? rel(file) : undefined
  }
  const moduleFile = (specifier: ts.Expression) =>
    declaredIn(checker.getSymbolAtLocation(specifier))

  const edges = new Map<
    string,
    { from: string; to: string; imported: Set<string>; reexported: Set<string> }
  >()
  const add = (from: string, to: string | undefined, name: string, reexport = false) => {
    if (!to || to === from) return
    const key = `${from}\0${to}`
    const edge = edges.get(key) ?? {
      from,
      to,
      imported: new Set(),
      reexported: new Set(),
    }
    ;(reexport ? edge.reexported : edge.imported).add(name)
    edges.set(key, edge)
  }

  for (const source of program.getSourceFiles()) {
    if (!project.has(source.fileName) || source.isDeclarationFile) continue
    const from = rel(source.fileName)
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause
        if (!clause) {
          add(from, moduleFile(statement.moduleSpecifier), '(side effect)')
          continue
        }
        if (clause.name)
          add(from, declaredIn(checker.getSymbolAtLocation(clause.name)), 'default')
        const bindings = clause.namedBindings
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const name = (element.propertyName ?? element.name).text
            add(
              from,
              declaredIn(checker.getSymbolAtLocation(element.name)) ??
                moduleFile(statement.moduleSpecifier),
              name,
            )
          }
        } else if (bindings) {
          // A namespace used only as a whole depends on the whole module.
          const uses = namespaceUses(
            source,
            checker.getSymbolAtLocation(bindings.name),
            (name, symbol) =>
              add(
                from,
                declaredIn(symbol) ?? moduleFile(statement.moduleSpecifier),
                name,
              ),
          )
          if (uses === 0) add(from, moduleFile(statement.moduleSpecifier), '*')
        }
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
        const clause = statement.exportClause
        if (clause && ts.isNamedExports(clause)) {
          for (const element of clause.elements) {
            add(
              from,
              declaredIn(checker.getExportSpecifierLocalTargetSymbol(element)) ??
                moduleFile(statement.moduleSpecifier),
              (element.propertyName ?? element.name).text,
              true,
            )
          }
        } else {
          add(from, moduleFile(statement.moduleSpecifier), '*', true)
        }
      }
    }
  }

  /** Each `ns.name` in the file, with the symbol it names; returns how many it found. */
  function namespaceUses(
    source: ts.SourceFile,
    namespace: ts.Symbol | undefined,
    onUse: (name: string, symbol: ts.Symbol | undefined) => void,
  ): number {
    let found = 0
    const visit = (node: ts.Node) => {
      const pair = ts.isPropertyAccessExpression(node)
        ? ([node.expression, node.name] as const)
        : ts.isQualifiedName(node)
          ? ([node.left, node.right] as const)
          : undefined
      if (
        pair &&
        ts.isIdentifier(pair[0]) &&
        checker.getSymbolAtLocation(pair[0]) === namespace
      ) {
        onUse(pair[1].text, checker.getSymbolAtLocation(pair[1]))
        found++
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)
    return found
  }

  const files: Record<string, FileFacts> = {}
  for (const source of program.getSourceFiles()) {
    if (!project.has(source.fileName) || source.isDeclarationFile) continue
    files[rel(source.fileName)] = fileFacts(source)
  }

  /** The top-level statement of `source` that holds `node`, if any. */
  function topLevel(node: ts.Node, source: ts.SourceFile): ts.Statement | undefined {
    let at: ts.Node = node
    while (at.parent && at.parent !== source) at = at.parent
    return at.parent === source ? (at as ts.Statement) : undefined
  }

  function fileFacts(source: ts.SourceFile): FileFacts {
    const declarations: Record<string, Declaration> = {}
    for (const statement of source.statements) {
      const key = keyOf(statement)
      if (key === '') continue
      const deps = new Set<string>()
      const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node)) {
          const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
          const owner =
            declaration && declaration.getSourceFile() === source
              ? topLevel(declaration, source)
              : undefined
          if (owner && owner !== statement && keyOf(owner) !== '') deps.add(keyOf(owner))
        }
        ts.forEachChild(node, visit)
      }
      ts.forEachChild(statement, visit)
      declarations[key] = {
        text: tokens(statement, source),
        deps: [...deps].sort(),
      }
    }
    const exports: Record<string, string | null> = {}
    const module = checker.getSymbolAtLocation(source)
    for (const symbol of module ? checker.getExportsOfModule(module) : []) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      const declaration = target.declarations?.[0]
      const owner =
        declaration && declaration.getSourceFile() === source
          ? topLevel(declaration, source)
          : undefined
      exports[symbol.name] = owner ? keyOf(owner) || null : null
    }
    const doc = leadingDoc(source)
    return { exports, declarations, ...(doc ? { doc } : {}) }
  }

  return {
    edges: [...edges.values()]
      .map(({ from, to, imported, reexported }) => {
        const reexports = [...reexported].filter((n) => !imported.has(n)).sort()
        return {
          from,
          to,
          names: [...new Set([...imported, ...reexported])].sort(),
          ...(reexports.length ? { reexports } : {}),
        }
      })
      .sort(byPair),
    files,
  }
}

/**
 * The edges of the change: added, removed, or kept with the names used now. The base's paths
 * are moved to where the change put them first, so a moved file keeps its edges.
 */
export function diffImports(
  base: ImportEdge[],
  head: ImportEdge[],
  moves: Map<string, string>,
): ImportChange[] {
  const moved = (path: string) => moves.get(path) ?? path
  const key = (e: ImportEdge) => `${e.from}\0${e.to}`
  const before = new Set(
    base.map((e) => key({ ...e, from: moved(e.from), to: moved(e.to) })),
  )
  const now = new Set(head.map(key))
  const changes: ImportChange[] = head.map((e) => ({
    ...e,
    status: before.has(key(e)) ? 'kept' : 'added',
  }))
  const removed = new Map<string, ImportChange>()
  for (const e of base) {
    const edge = { ...e, from: moved(e.from), to: moved(e.to) }
    if (now.has(key(edge))) continue
    const known = removed.get(key(edge))
    if (known) known.names = [...new Set([...known.names, ...edge.names])].sort()
    else removed.set(key(edge), { ...edge, status: 'removed' })
  }
  return [...changes, ...removed.values()].sort(byPair)
}

// Only the files a TypeScript program can read are loaded from git.
const SOURCE = /\.(?:[cm]?tsx?|json)$/

/** The source files of a commit, read from git in one batch. */
export function gitTree(cwd: string, ref: string): SourceTree {
  const listing = execFileSync('git', ['ls-tree', '-r', '-z', ref], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const blobs = listing
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta = '', path = ''] = line.split('\t')
      const [, type, sha] = meta.split(' ')
      return { path, type, sha: sha ?? '' }
    })
    .filter(
      (b) =>
        b.type === 'blob' && SOURCE.test(b.path) && !b.path.startsWith('node_modules/'),
    )
  const out = execFileSync('git', ['cat-file', '--batch'], {
    cwd,
    input: blobs.map((b) => b.sha).join('\n') + '\n',
    maxBuffer: 256 * 1024 * 1024,
  })
  const texts = new Map<string, string>()
  let at = 0
  for (const blob of blobs) {
    const headerEnd = out.indexOf(10, at)
    const size = Number(out.subarray(at, headerEnd).toString('utf8').split(' ')[2])
    texts.set(
      blob.path,
      out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'),
    )
    at = headerEnd + 1 + size + 1
  }
  return { files: [...texts.keys()], read: (path) => texts.get(path) }
}

/** The source files of the working tree: tracked and untracked, without ignored ones. */
export function workingTree(cwd: string): SourceTree {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter((path) => SOURCE.test(path) && existsSync(join(cwd, path)))
  return {
    files,
    read: (path) => {
      try {
        return readFileSync(join(cwd, path), 'utf8')
      } catch {
        return undefined
      }
    },
  }
}

/** The import and export changes between `from` and the working tree, and the doc comments. */
export interface CodeChanges {
  edges: ImportChange[]
  exports: ExportDiff['exports']
  barrels: ExportDiff['barrels']
  /** The leading doc comment of each project file now. */
  docs: Record<string, string>
}

/** The code changes between `from` and the working tree; each side's program is built once. */
export function readCodeChanges(
  cwd: string,
  from: string,
  moves: Map<string, string>,
  changed: Set<string>,
  configPath = 'tsconfig.app.json',
): CodeChanges {
  const base = programFacts(gitTree(cwd, from), configPath)
  const head = programFacts(workingTree(cwd), configPath)
  const { exports, barrels } = diffExports(base, head, moves, changed)
  const docs: Record<string, string> = {}
  for (const [path, file] of Object.entries(head.files))
    if (file.doc) docs[path] = file.doc
  return { edges: diffImports(base.edges, head.edges, moves), exports, barrels, docs }
}

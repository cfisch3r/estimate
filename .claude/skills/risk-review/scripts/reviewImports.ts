import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
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

  const edges = new Map<string, ImportEdge>()
  const add = (from: string, to: string | undefined, name: string) => {
    if (!to || to === from) return
    const key = `${from}\0${to}`
    const edge = edges.get(key) ?? { from, to, names: [] }
    if (!edge.names.includes(name)) edge.names.push(name)
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
          namespaceUses(
            source,
            checker.getSymbolAtLocation(bindings.name),
            (name, symbol) =>
              add(
                from,
                declaredIn(symbol) ?? moduleFile(statement.moduleSpecifier),
                name,
              ),
          )
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
            )
          }
        } else {
          add(from, moduleFile(statement.moduleSpecifier), '*')
        }
      }
    }
  }

  /** Each `ns.name` in the file, with the symbol it names. */
  function namespaceUses(
    source: ts.SourceFile,
    namespace: ts.Symbol | undefined,
    use: (name: string, symbol: ts.Symbol | undefined) => void,
  ) {
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
        use(pair[1].text, checker.getSymbolAtLocation(pair[1]))
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)
  }

  return [...edges.values()]
    .map((e) => ({ ...e, names: [...e.names].sort() }))
    .sort(byPair)
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

/** The import changes between `from` and the working tree, by the given configuration. */
export function readImportChanges(
  cwd: string,
  from: string,
  moves: Map<string, string>,
  configPath = 'tsconfig.app.json',
): ImportChange[] {
  return diffImports(
    importEdges(gitTree(cwd, from), configPath),
    importEdges(workingTree(cwd), configPath),
    moves,
  )
}

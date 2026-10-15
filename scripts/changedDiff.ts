import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The changed files of a branch, as the review floor needs them. It does not need a local
// `main`: the base is `origin/main` when that exists, otherwise `main`. Everything the
// diff checks read (file contents before and after, added lines) is behind a small
// interface so the floor logic can be tested without git.

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export interface ChangedFile {
  path: string
  /** The path before a rename. */
  oldPath?: string
  status: ChangeStatus
  /** Git's similarity for a rename, 0 to 100. */
  similarity?: number
}

export interface Diff {
  files: ChangedFile[]
  /** The file's text at the base, or undefined when it did not exist there. */
  before(path: string): string | undefined
  /** The file's text now, or undefined when it no longer exists. */
  after(path: string): string | undefined
  /** The lines the change added to the file (without the leading `+`). */
  addedLines(file: ChangedFile): string[]
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function gitOrUndefined(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

/** The ref of the default branch: `origin/main` if it exists, otherwise `main`. */
export function baseRef(cwd: string): string {
  for (const ref of ['origin/main', 'main']) {
    if (gitOrUndefined(cwd, ['rev-parse', '--verify', '--quiet', ref]) !== undefined) {
      return ref
    }
  }
  throw new Error('Neither origin/main nor main exists; fetch main first.')
}

const STATUS: Record<string, ChangeStatus> = {
  A: 'added',
  M: 'modified',
  T: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'added',
}

// `git diff --name-status -z` prints `X\0path\0`, and `R<score>\0old\0new\0` for a rename.
function parseNameStatus(raw: string): ChangedFile[] {
  const tokens = raw.split('\0')
  const files: ChangedFile[] = []
  for (let i = 0; i < tokens.length;) {
    const code = tokens[i++]
    if (!code) continue
    const letter = code.charAt(0)
    const status = STATUS[letter]
    if (!status) throw new Error(`Unexpected git status "${code}"`)
    if (letter === 'R' || letter === 'C') {
      const oldPath = tokens[i++] ?? ''
      const path = tokens[i++] ?? ''
      files.push(
        letter === 'R'
          ? { path, oldPath, status, similarity: Number(code.slice(1)) }
          : { path, status },
      )
    } else {
      files.push({ path: tokens[i++] ?? '', status })
    }
  }
  return files
}

/**
 * The diff of the working tree against `from` (a commit-ish): committed, uncommitted and
 * untracked files. `from` defaults to the merge base with the default branch.
 */
export function readGitDiff(options: { cwd?: string; from?: string } = {}): Diff {
  const cwd = options.cwd ?? process.cwd()
  const from = options.from ?? git(cwd, ['merge-base', baseRef(cwd), 'HEAD']).trim()

  const tracked = parseNameStatus(git(cwd, ['diff', '--name-status', '-z', '-M', from]))
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((path): ChangedFile => ({ path, status: 'added' }))
  const files = [...tracked, ...untracked]

  const untrackedPaths = new Set(untracked.map((f) => f.path))
  return {
    files,
    before: (path) => gitOrUndefined(cwd, ['show', `${from}:${path}`]),
    after: (path) => {
      try {
        return readFileSync(join(cwd, path), 'utf8')
      } catch {
        return undefined
      }
    },
    addedLines: (file) => {
      if (untrackedPaths.has(file.path)) {
        return readText(cwd, file.path).split('\n')
      }
      const paths = file.oldPath ? [file.oldPath, file.path] : [file.path]
      const patch = git(cwd, ['diff', '-U0', '--no-color', '-M', from, '--', ...paths])
      return patch
        .split('\n')
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
    },
  }
}

function readText(cwd: string, path: string): string {
  try {
    return readFileSync(join(cwd, path), 'utf8')
  } catch {
    return ''
  }
}

/** The text of a file at a commit-ish, for reading the catalogue from the base. */
export function showAt(ref: string, path: string, cwd = process.cwd()): string {
  return git(cwd, ['show', `${ref}:${path}`])
}

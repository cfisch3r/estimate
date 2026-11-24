// The port through which saving and loading hand a session to and from a file.
// The application layer owns this interface; `adapters/file` implements it and
// `app/` provides it (ADR-009). No React here, so adapters and specs may import it.
import type { Result } from '../../../domain/estimate'
import type { SavedSession, SavedSessionError } from '../../../domain/savedSession'

/** A calendar date in the user's own time zone. */
export type LocalDate = { year: number; month: number; day: number }

/** A file the user picked. A browser `File` has this shape. */
export interface PickedFile {
  readonly name: string
  text(): Promise<string>
}

/** Why a picked file wasn't loaded. Carries no text: the UI words each code. */
export type SessionFileRejection =
  /** The file was moved, deleted or locked after it was picked. */
  | { code: 'unreadable' }
  | { code: 'not-a-session-file' }
  | { code: 'newer-version' }
  | SavedSessionError

export interface SessionFileApi {
  /** Hands `session` to the user as a file saved on `savedOn`; returns the
   *  file's name. */
  save: (session: SavedSession, savedOn: LocalDate) => string
  /** The session in `file`, or why it can't be loaded: never part of one. */
  open: (file: PickedFile) => Promise<Result<SavedSession, SessionFileRejection>>
}

import type { BookEntry } from '../types'

const STORE_KEY = 'bookStore'
const SHOWN_KEY = 'shownBookIds'

function makeKey(title: string, author: string): string {
  return `${title.toLowerCase().trim()}::${author.toLowerCase().trim()}`
}

function readStore(): BookEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeStore(entries: BookEntry[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries))
}

/**
 * Merge an array of incoming books into the store.
 * CSV re-uploads are treated as authoritative (overwrite existing entries).
 */
export function mergeBooks(
  incoming: Omit<BookEntry, 'book_key' | 'date_updated'>[],
): { total: number; updated: number } {
  const store = readStore()
  const storeMap = new Map<string, BookEntry>(store.map(e => [e.book_key, e]))
  let updated = 0

  for (const b of incoming) {
    const key = makeKey(b.title, b.author)
    const existing = storeMap.get(key)
    if (existing) {
      updated++
    }
    storeMap.set(key, {
      ...b,
      book_key: key,
      date_updated: new Date().toISOString(),
    })
  }

  writeStore(Array.from(storeMap.values()))
  return { total: storeMap.size, updated }
}

/**
 * Upsert a single book. If a book with the same title+author exists,
 * its rating and source are overwritten.
 */
export function upsertBook(
  book: Omit<BookEntry, 'book_key' | 'date_updated'>,
): void {
  const store = readStore()
  const key = makeKey(book.title, book.author)
  const idx = store.findIndex(e => e.book_key === key)
  const entry: BookEntry = {
    ...book,
    book_key: key,
    date_updated: new Date().toISOString(),
  }
  if (idx >= 0) {
    store[idx] = entry
  } else {
    store.push(entry)
  }
  writeStore(store)
}

/** Books with rating >= 1, sent to the backend for recommendations. */
export function getRatedBooks(): BookEntry[] {
  return readStore().filter(e => e.rating >= 1)
}

/** All books in the store (for the book table). */
export function getAllBooks(): BookEntry[] {
  return readStore()
}

/** Total number of books in the store. */
export function getBookCount(): number {
  return readStore().length
}

// --- Shown book ID tracking (to avoid repeats on refresh) ---

export function getShownBookIds(): string[] {
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addShownBookIds(ids: string[]): void {
  const current = getShownBookIds()
  const next = Array.from(new Set([...current, ...ids]))
  localStorage.setItem(SHOWN_KEY, JSON.stringify(next))
}

export function clearShownBookIds(): void {
  localStorage.removeItem(SHOWN_KEY)
}

export function clearAll(): void {
  localStorage.removeItem(STORE_KEY)
  localStorage.removeItem(SHOWN_KEY)
}

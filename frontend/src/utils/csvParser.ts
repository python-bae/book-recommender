import Papa from 'papaparse'
import type { BookEntry } from '../types'

type RawRow = Record<string, string>

function cleanIsbn(val: string | undefined): string | undefined {
  if (!val) return undefined
  // Strip Excel's ="..." wrapping
  return val.replace(/^="?/, '').replace(/"?$/, '').trim() || undefined
}

function makeKey(title: string, author: string): string {
  return `${title.toLowerCase().trim()}::${author.toLowerCase().trim()}`
}

export function parseGoodreadsCSV(file: File): Promise<BookEntry[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const rows = results.data
        if (rows.length === 0) {
          reject(new Error('CSV file is empty'))
          return
        }

        // Validate required columns
        const firstRow = rows[0]
        const required = ['Title', 'Author', 'My Rating', 'Exclusive Shelf']
        const missing = required.filter(col => !(col in firstRow))
        if (missing.length > 0) {
          reject(
            new Error(
              `This doesn't look like a Goodreads export. Missing columns: ${missing.join(', ')}`
            )
          )
          return
        }

        const books: BookEntry[] = rows
          .filter(row => row['Title']?.trim())
          .map(row => {
            const title = row['Title']?.trim() || ''
            const author = row['Author']?.trim() || ''
            const rating = parseInt(row['My Rating'] || '0', 10) || 0
            const shelf = row['Exclusive Shelf']?.trim() || 'read'

            return {
              book_key: makeKey(title, author),
              title,
              author,
              rating,
              shelf,
              review: row['My Review']?.trim() || undefined,
              bookshelves: row['Bookshelves']?.trim() || undefined,
              isbn: cleanIsbn(row['ISBN'] || row['ISBN13']),
              source: 'goodreads' as const,
              date_updated: new Date().toISOString(),
            }
          })

        resolve(books)
      },
      error(err) {
        reject(new Error(`CSV parse error: ${err.message}`))
      },
    })
  })
}

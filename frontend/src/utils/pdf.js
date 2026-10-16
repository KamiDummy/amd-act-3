import { pdfjs } from 'react-pdf'

// Same PDF.js build that react-pdf uses, so validation and the viewer always agree.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export const MAX_PAGES = 100
export const MAX_SIZE_MB = 20
const PAGES_TO_CHECK_FOR_TEXT = 3

// Checks that a file is a readable, text-based PDF within our limits.
// Resolves with { pageCount } or throws an Error with a user-facing message.
export async function validatePdf(file) {
  const hasPdfName =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!hasPdfName) {
    throw new Error('Only PDF files are supported.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File is larger than ${MAX_SIZE_MB} MB.`)
  }

  const data = new Uint8Array(await file.arrayBuffer())

  // The extension can lie; a real PDF has "%PDF-" near the start of the file.
  const header = new TextDecoder('latin1').decode(data.subarray(0, 1024))
  if (!header.includes('%PDF-')) {
    throw new Error('This file is not a valid PDF.')
  }

  const loadingTask = pdfjs.getDocument({ data })
  let pdf
  try {
    pdf = await loadingTask.promise
  } catch (err) {
    loadingTask.destroy()
    if (err?.name === 'PasswordException') {
      throw new Error('Password-protected PDFs are not supported.', {
        cause: err,
      })
    }
    throw new Error('This PDF could not be read. It may be damaged.', {
      cause: err,
    })
  }

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(
        `This PDF has ${pdf.numPages} pages. The limit is ${MAX_PAGES}.`,
      )
    }
    if (!(await hasSelectableText(pdf))) {
      throw new Error(
        'This PDF has no selectable text (it looks scanned). Only text-based PDFs are supported.',
      )
    }
    return { pageCount: pdf.numPages }
  } finally {
    // Frees the PDF.js worker memory; we only needed the PDF to inspect it.
    loadingTask.destroy()
  }
}

// Scanned PDFs are just images, so the AI would have nothing to read.
async function hasSelectableText(pdf) {
  const pagesToCheck = Math.min(PAGES_TO_CHECK_FOR_TEXT, pdf.numPages)
  for (let pageNumber = 1; pageNumber <= pagesToCheck; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const { items } = await page.getTextContent()
    if (items.some((item) => item.str?.trim())) {
      return true
    }
  }
  return false
}

import { redirect } from 'next/navigation'

// Notebooks live on the bookshelf.
export default function NotebooksIndex() {
  redirect('/journal')
}

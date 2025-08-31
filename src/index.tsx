/* @refresh reload */
import { render } from 'solid-js/web'
import { NotesProvider } from './context/NotesContext'
import App from './App.tsx'
import 'virtual:uno.css'

const root = document.getElementById('root')

render(
    () => (
      <NotesProvider> {/* Wrap App here */}
        <App />
      </NotesProvider>
    ), root!);
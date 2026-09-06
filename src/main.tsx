import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root'
import './styles.css'
import './public.css'
import './request-workflow.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)

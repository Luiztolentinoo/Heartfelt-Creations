import { useState } from 'react'
import StaffApp from './App'
import PublicPortal from './PublicPortal'

export default function Root() {
  const [area, setArea] = useState<'public' | 'staff'>('public')

  if (area === 'staff') {
    return <div className="staff-area-wrapper">
      <button className="back-to-public" onClick={() => setArea('public')}>← Voltar ao portal público</button>
      <StaffApp />
    </div>
  }

  return <PublicPortal onOpenStaff={() => setArea('staff')} />
}

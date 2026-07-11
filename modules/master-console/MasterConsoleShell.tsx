'use client'

import { useCallback, useEffect, useState } from 'react'
import { VTM_THEME_CLASS } from '@/modules/ui/vtm-theme'
import DesktopSizeGuard from './components/DesktopSizeGuard'
import MasterConsoleSidebar from './components/MasterConsoleSidebar'
import MasterConsoleTopbar from './components/MasterConsoleTopbar'
import MasterModuleHost from './components/MasterModuleHost'
import MasterRightRail from './components/MasterRightRail'
import { DEFAULT_MASTER_MODULE_ID, getMasterContribution } from './contributions'
import type { MasterRollRequest } from './types'

type MasterConsoleShellProps = {
  room: string
  onLock: () => void
}

function readModuleFromUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_MASTER_MODULE_ID
  const moduleId = new URLSearchParams(window.location.search).get('module')
  if (moduleId && getMasterContribution(moduleId)) return moduleId
  return DEFAULT_MASTER_MODULE_ID
}

export default function MasterConsoleShell({ room, onLock }: MasterConsoleShellProps) {
  const [activeModuleId, setActiveModuleId] = useState(DEFAULT_MASTER_MODULE_ID)
  const [rollRequest, setRollRequest] = useState<MasterRollRequest | null>(null)

  useEffect(() => {
    setActiveModuleId(readModuleFromUrl())
  }, [])

  const onSelectModule = useCallback((id: string) => {
    if (!getMasterContribution(id)) return
    setActiveModuleId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('module', id)
    window.history.replaceState({}, '', url.toString())
  }, [])

  return (
    <div className={`master-console ${VTM_THEME_CLASS}`}>
      <MasterConsoleTopbar room={room} onLock={onLock} />
      <div className="master-console-layout">
        <MasterConsoleSidebar
          activeModuleId={activeModuleId}
          onSelectModule={onSelectModule}
        />
        <MasterModuleHost
          room={room}
          activeModuleId={activeModuleId}
          onRequestRoll={setRollRequest}
        />
        <MasterRightRail
          room={room}
          rollRequest={rollRequest}
          onClearRollRequest={() => setRollRequest(null)}
        />
      </div>
      <DesktopSizeGuard />
    </div>
  )
}

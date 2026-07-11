import { VTM_THEME_CLASS } from '@/modules/ui/vtm-theme'
import DesktopSizeGuard from './components/DesktopSizeGuard'
import MasterConsoleSidebar from './components/MasterConsoleSidebar'
import MasterConsoleTopbar from './components/MasterConsoleTopbar'
import MasterModuleHost from './components/MasterModuleHost'
import MasterRightRail from './components/MasterRightRail'

type MasterConsoleShellProps = {
  room: string
  onLock: () => void
}

export default function MasterConsoleShell({ room, onLock }: MasterConsoleShellProps) {
  return (
    <div className={`master-console ${VTM_THEME_CLASS}`}>
      <MasterConsoleTopbar room={room} onLock={onLock} />
      <div className="master-console-layout">
        <MasterConsoleSidebar />
        <MasterModuleHost />
        <MasterRightRail />
      </div>
      <DesktopSizeGuard />
    </div>
  )
}

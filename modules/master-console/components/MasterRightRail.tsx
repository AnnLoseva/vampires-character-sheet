'use client'

import { MasterRoller } from '@/modules/master-rolls'
import type { MasterRollRequest } from '../types'

type MasterRightRailProps = {
  room: string
  rollRequest: MasterRollRequest | null
  onClearRollRequest?: () => void
}

/**
 * Permanent right rail — must not unmount when the central module changes.
 */
export default function MasterRightRail({
  room,
  rollRequest,
  onClearRollRequest,
}: MasterRightRailProps) {
  return (
    <aside className="master-right-rail" aria-label="Инструменты рассказчика">
      <MasterRoller
        room={room}
        rollRequest={rollRequest}
        onClearRollRequest={onClearRollRequest}
      />
    </aside>
  )
}

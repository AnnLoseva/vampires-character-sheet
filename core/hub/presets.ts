import { createVtm5SystemCore } from '@/core/systems/vtm5'
import { chatModuleDefinition } from '@/modules/chat/module-definition'
import { characterSheetModuleDefinition } from '@/modules/character-sheet/module-definition'
import { homeModuleDefinition } from '@/modules/home/module-definition'
import { journalModuleDefinition } from '@/modules/journal/module-definition'
import { musicModuleDefinition } from '@/modules/music/module-definition'
import { referenceModuleDefinition } from '@/modules/reference/module-definition'
import { rollsModuleDefinition } from '@/modules/rolls/module-definition'
import { tableModuleDefinition } from '@/modules/table/module-definition'
import { createChronicleHub } from './hub'
import type { ChronicleHub } from './types'

/** Hub preloaded with VTM5 and the core VTM5 feature modules. */
export function createVtm5ChronicleHub(): ChronicleHub {
  const vtm5 = createVtm5SystemCore()

  return createChronicleHub({
    systems: [vtm5.system],
    modules: [
      { module: homeModuleDefinition, enabledByDefault: true },
      { module: tableModuleDefinition, enabledByDefault: true },
      { module: chatModuleDefinition, enabledByDefault: true },
      { module: musicModuleDefinition, enabledByDefault: true },
      { module: rollsModuleDefinition, enabledByDefault: true },
      { module: characterSheetModuleDefinition, enabledByDefault: true },
      { module: journalModuleDefinition, enabledByDefault: true },
      { module: referenceModuleDefinition, enabledByDefault: true },
    ],
  })
}

import { createVtm5SystemCore } from '@/core/systems/vtm5'
import { characterSheetModuleDefinition } from '@/modules/character-sheet/module-definition'
import { journalModuleDefinition } from '@/modules/journal/module-definition'
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
      { module: tableModuleDefinition, enabledByDefault: true },
      { module: rollsModuleDefinition, enabledByDefault: true },
      { module: characterSheetModuleDefinition, enabledByDefault: true },
      { module: journalModuleDefinition, enabledByDefault: true },
      { module: referenceModuleDefinition, enabledByDefault: true },
    ],
  })
}
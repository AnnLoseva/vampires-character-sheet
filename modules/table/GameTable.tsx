'use client'

/**
 * Campaign table orchestrator: wires UI panels, hooks, and module APIs together.
 * Data access (Supabase) lives in @/modules/table/api/*; state in @/modules/table/hooks/*.
 */
import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import dynamic from 'next/dynamic'
import { ATTRIBUTE_NAME_EN, findCrossLanguageName, getAttributeDots, resolveSkillValue, SKILL_NAME_EN } from '@/lib/i18n/ruleNames'
import { useLang } from '@/lib/i18n/LanguageProvider'
import MusicPlayer from '@/modules/music/components/MusicPlayer'
import type { DiceOverlayGroup, DiceOverlayRoll } from '@/modules/rolls/components/DiceRollOverlay'
import GameTableStyles from './components/GameTableStyles'
import LayerManager from './components/layers/LayerManager'
import TableCanvas from './components/canvas/TableCanvas'
import TableLeftPanel from './components/panels/TableLeftPanel'
import TableRightPanel from './components/panels/TableRightPanel'
import SceneManager from './components/scenes/SceneManager'
import MediaLibrary from './components/media/MediaLibrary'
import { ChatPanel, useChat } from '@/modules/chat'
import type { ChatUser } from '@/modules/chat/types'
import JournalPanel from '@/modules/journal/components/JournalPanel'
import MasterPanel from './components/master/MasterPanel'
import defaultRules from '@/public/rules.json'
import {
  broadcastMusicChannel,
  getMusicProvider,
  parseYouTubeUrl,
} from '@/modules/music/utils'
import {
  ATTRIBUTE_GROUPS,
  DEFAULT_SCENE_NAME,
  ROOT_LAYER_DROP_ID,
  SKILL_GROUPS,
  type InventoryCategory,
} from '@/modules/table/constants'
import {
  mapCharacterRow,
  getCharacterType,
  getDefaultDamageProfile,
  normalizeWillpowerTracker,
} from '@/modules/table/mappers'
import {
  extractImageUrlsFromHtml,
  extractVideoUrlsFromHtml,
  getDocumentEmbedUrl,
  getDroppedMediaUrls,
  getEmbeddableVideoUrl,
  getFileLayerMeta,
  getFileText,
  getImageNameFromUrl,
  getMediaSize,
  getMediaUrlsFromText,
  getStoragePathFromPublicUrl,
  getTextLayerData,
  isReadableTextFile,
  isWordLikeFile,
  safeStorageName,
} from '@/modules/table/utils/media-utils'
import {
  getCharacterBloodPotency,
  getCharacterDamageProfile,
  getCharacterHealth,
  getCharacterHealthStamina,
  getCharacterHunger,
  getCharacterWillpower,
  getWillpowerImpairmentPenalty,
  getWillpowerMetaState,
  getWillpowerRecoveryPool,
} from '@/modules/table/utils/character-state'
import {
  createEditorState,
  getEditorImageStyle,
  buildLayerTree,
  getAncestorIds,
  getDescendantIds,
  getLayerClipboardText,
  getLayerCrop,
  getLayerMediaStyle,
  getLayerShareUrl,
  getSmartFloatingPosition,
  isLayerEffectivelyVisible,
  mergeRoll,
  sortLayers,
} from '@/modules/table/utils/layer-utils'
import { sortSceneMusic, upsertScene } from '@/modules/table/utils/scene-utils'
import {
  activateSceneRecord,
  clearSceneMusicDefaults,
  createTableId,
  deactivateOtherScenes,
  deleteSceneMusicRecord,
  deleteSceneWithAssets,
  fetchSceneMusic,
  insertScene,
  insertSceneMusic,
  updateSceneMusicRecord,
  updateSceneRecord,
} from '@/modules/table/api/scene-api'
import {
  updateLayerRecords,
  uploadTableImageFile,
} from '@/modules/table/api/layer-api'
import {
  fetchCharacterById,
  updateCharacterData,
} from '@/modules/table/api/character-api'
import {
  insertRollRecord,
  updateRollRecord,
} from '@/modules/table/api/roll-api'
import {
  uploadSceneMusicAudioFile,
  upsertTableMusicState,
} from '@/modules/table/api/music-api'
import {
  CharacterPreviewModal,
  DisciplinePowerPanel,
  MasterPasswordGate,
  MasterRoleTopbar,
  OpposedRollModal,
  RollModifierControls,
  SmartContextMenu,
  WillpowerRerollControls,
  summarizeRollModifier,
} from '@/modules/table/components'
import {
  type DisciplinePowerEntry,
  type DisciplineRule,
  getActiveEffectDescription,
  getActiveEffectTitle,
  getCharacterPoolPartDots,
  getDefaultDisciplineRules,
  getDisciplineCostLabel,
  getDisciplineManualPrompts,
  getDisciplinePowerDots,
  getDisciplinePowerEntries,
  getDisciplinePowerEntryKey,
  getDisciplinePowerInputFields,
  getPowerDifficultySummary,
  getPowerRollFormula,
  getPowerRollSummary,
  getSelectedDisciplinePowerLabels,
  getSelectedPathPowerNames,
  getSkillDotValue,
  getStandaloneSelectedPowerNames,
  hasSelectedPathPowers,
  isPowerEntrySelected,
  parsePowerPool,
  resolvePowerPool,
} from '@/modules/table/utils/discipline-ui'
import { formatRuleValue, formatTime, getDotDisplay } from '@/modules/table/utils/display'

import { getRollPenalties, getRollTraits } from '@/modules/table/utils/roll-pool-helpers'
import { getDieImage } from '@/modules/table/utils/dice-display'
import {
  getExtraTraitNames,
  getRollDieId,
  getWillpowerRerollEligibleDieIds,
  isWillpowerRerollExcluded,
} from '@/modules/table/utils/roll-utils'
import {
  useCharacterActions,
  useDisciplineActions,
  useInventoryActions,
  useLayerActions,
  usePoolRollActions,
  useRoomSession,
  useTableVoice,
  useTableLayers,
  useTableRealtime,
  useTableRolls,
  useTableScenes,
} from '@/modules/table/hooks'
import { DEFAULT_OPPOSED_RESPONSE } from '@/modules/rolls/constants'
import { rollsDice } from '@/modules/rolls/system-runtime'
import type {
  ContestedOpponentOption,
  DisciplineRollContext,
  QuickRollOptions,
} from '@/modules/rolls/types'
import { createQuickRollFactory } from '@/modules/rolls/hooks'
import {
  applyWillpowerRerollToDice,
  buildAnsweredOpposedRoll,
  getActivePenaltyDelta,
  getActiveRollModifierWarnings,
  getBloodSurgeBonus,
  getRouseWarning,
} from '@/modules/rolls/utils'
import {
  tableApplyDisciplineEffectsToRoll,
  tableDisciplines,
  tableGetDerivedStats,
  tableHealth,
  tableHumanity,
} from '@/modules/table/system-runtime'
import type {
  DisciplineRollEffectResult,
  DisciplineRollPenalty,
} from '@/core/systems/vtm5/rules/disciplines/effects'
import type {
  DisciplineCost,
  DisciplineCostPayment,
} from '@/core/systems/vtm5/rules/disciplines/costs'
import type { ActiveEffect } from '@/core/systems/vtm5/rules/disciplines/schema'
import type { DamageSeverity, HealthDamageOptions } from '@/core/systems/vtm5/rules/health'
import type {
  ActiveParticipant,
  BlendMode,
  CharacterOption,
  CharacterRow,
  Die,
  DragState,
  ImageEditorDraft,
  ImageEditorState,
  InventoryItem,
  JournalEntry,
  LayerContextMenu,
  LayerDropPlacement,
  LayerDropTarget,
  LayerPatch,
  LayerTreeNode,
  LeftToolbarTab,
  MasterReveal,
  MasterWhisper,
  NormalizedHealth,
  MediaTab,
  OpposedRollProposal,
  OpposedRollResult,
  OpposedRollSide,
  RollMeta,
  RollPoolBuilder,
  RollMode,
  RightRailTab,
  RollMessage,
  RouseCheckResult,
  SceneMusicTrack,
  SelectionRect,
  TableLayer,
  TableRole,
  TableScene,
  TouchGestureState,

  WillpowerRerollDraft,
} from '@/modules/table/types'

const DiceRollOverlay = dynamic(() => import('@/modules/rolls/components/DiceRollOverlay'), { ssr: false })

const defaultDisciplineRules = getDefaultDisciplineRules(defaultRules)

export default function VampireTable() {
  const { t, tf, lang } = useLang()
  const d10 = (n: number) => lang === 'en' ? `${n}d10` : `${n}к10`
  const {
    room,
    roomRef,
    tableRole,
    isMaster,
    masterPasswordDraft,
    setMasterPasswordDraft,
    masterPasswordEdit,
    setMasterPasswordEdit,
    enterAsMaster,
    saveMasterPassword,
    resetTableRole,
    chooseTableRole,
  } = useRoomSession({ t })
  const { rolls, setRolls, rollsStatus } = useTableRolls(room)
  const {
    scenes,
    setScenes,
    activeSceneId,
    setActiveSceneId,
    selectedSceneId,
    setSelectedSceneId,
    sceneMusic,
    setSceneMusic,
    sceneMusicDraft,
    setSceneMusicDraft,
    sceneStatus,
    setSceneStatus,
    scenesRef,
    activeSceneIdRef,
    sceneMusicRef,
    loadSceneMusic,
    ensureDefaultScene,
  } = useTableScenes(room, t(DEFAULT_SCENE_NAME))
  const {
    layers,
    setLayers,
    layersRef,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayerIds,
    setSelectedLayerIds,
    loadLayersForScene: loadLayersForSceneCore,
  } = useTableLayers()
  const [diceOverlayQueue, setDiceOverlayQueue] = useState<DiceOverlayRoll[]>([])
  const shownDiceOverlayIdsRef = useRef<Set<string>>(new Set())
  const [roomParticipants, setRoomParticipants] = useState<ActiveParticipant[]>([])
  const [previewCharacter, setPreviewCharacter] = useState<CharacterOption | null>(null)
  const [previewCharacterTab, setPreviewCharacterTab] = useState<'mechanics' | 'inventory'>('mechanics')
  const [previewRollAttribute, setPreviewRollAttribute] = useState('')
  const [previewRollAttributeTwo, setPreviewRollAttributeTwo] = useState('')
  const [previewRollSkill, setPreviewRollSkill] = useState('')
  const [previewRollDiscipline, setPreviewRollDiscipline] = useState('')
  const [previewRollModifier, setPreviewRollModifier] = useState(0)
  const [disabledPreviewRollModifierIds, setDisabledPreviewRollModifierIds] = useState<string[]>([])
  const [previewRollMode, setPreviewRollMode] = useState<RollMode>('normal')
  const [previewContestedOpponentId, setPreviewContestedOpponentId] = useState('')
  const [selectedMasterRollCharacterId, setSelectedMasterRollCharacterId] = useState('')
  const [masterRollVisibility, setMasterRollVisibility] = useState<'public' | 'hidden'>('hidden')
  const [masterRollAttribute, setMasterRollAttribute] = useState('')
  const [masterRollAttributeTwo, setMasterRollAttributeTwo] = useState('')
  const [masterRollSkill, setMasterRollSkill] = useState('')
  const [masterRollDiscipline, setMasterRollDiscipline] = useState('')
  const [masterRollModifier, setMasterRollModifier] = useState(0)
  const [disabledMasterRollModifierIds, setDisabledMasterRollModifierIds] = useState<string[]>([])
  const [masterRollMode, setMasterRollMode] = useState<RollMode>('normal')
  const [masterContestedOpponentId, setMasterContestedOpponentId] = useState('')
  const [incomingOpposedProposal, setIncomingOpposedProposal] = useState<OpposedRollProposal | null>(null)
  const [opposedResponseSide, setOpposedResponseSide] = useState<RollPoolBuilder>({ ...DEFAULT_OPPOSED_RESPONSE })
  const [previewDisciplineName, setPreviewDisciplineName] = useState('')
  const [disciplineRules, setDisciplineRules] = useState<Record<string, DisciplineRule> | null>(null)
  const [disciplineRulesStatus, setDisciplineRulesStatus] = useState('')
  const [previewPowerName, setPreviewPowerName] = useState('')
  const [previewPowerPoolSelections, setPreviewPowerPoolSelections] = useState<string[]>([])
  const [previewPowerModifier, setPreviewPowerModifier] = useState(0)
  const [disabledPreviewPowerModifierIds, setDisabledPreviewPowerModifierIds] = useState<string[]>([])
  const [previewPowerInputValues, setPreviewPowerInputValues] = useState<Record<string, string>>({})
  const [previewUseBloodSurge, setPreviewUseBloodSurge] = useState(false)
  const [masterUseBloodSurge, setMasterUseBloodSurge] = useState(false)
  const [willpowerRerollDraft, setWillpowerRerollDraft] = useState<WillpowerRerollDraft | null>(null)
  const [quickInventoryName, setQuickInventoryName] = useState('')
  const [quickInventoryCategory, setQuickInventoryCategory] = useState<InventoryCategory>('Другое')
  const [quickInventoryQuantity, setQuickInventoryQuantity] = useState(1)
  const [quickInventoryStatus, setQuickInventoryStatus] = useState('')
  const [isQuickInventoryBusy, setIsQuickInventoryBusy] = useState(false)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState('')
  const [journalSearch, setJournalSearch] = useState('')
  const [journalSaveStatus, setJournalSaveStatus] = useState('Сохранено')
  const [masterReveals, setMasterReveals] = useState<MasterReveal[]>([])
  const [masterWhispers, setMasterWhispers] = useState<MasterWhisper[]>([])
  const [masterChatDraft, setMasterChatDraft] = useState('')
  const [selectedMasterChatUserId, setSelectedMasterChatUserId] = useState('')

  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null)
  const [connectionText, setConnectionText] = useState('Подключение...')
  const [tableStatus, setTableStatus] = useState('Загрузка стола...')
  const [handNotice, setHandNotice] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [mediaUrlDraft, setMediaUrlDraft] = useState('')
  const [mediaSearchDraft, setMediaSearchDraft] = useState('')
  const [textMaterialDraft, setTextMaterialDraft] = useState('')
  const [textMaterialNameDraft, setTextMaterialNameDraft] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [layerContextMenu, setLayerContextMenu] = useState<LayerContextMenu>(null)
  const [imageEditor, setImageEditor] = useState<ImageEditorDraft | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [layerDropTarget, setLayerDropTarget] = useState<LayerDropTarget>(null)
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>('rolls')
  const [mediaTab, setMediaTab] = useState<MediaTab>('layers')
  const [leftToolbarTab, setLeftToolbarTab] = useState<LeftToolbarTab>('scenes')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [musicPanelOpen, setMusicPanelOpen] = useState(true)
  const [selectionRect, setSelectionRect] = useState<SelectionRect>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const backgroundFileInputRef = useRef<HTMLInputElement>(null)
  const sceneMusicFileInputRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const triggerDiceOverlayRef = useRef<((roll: RollMessage) => void) | null>(null)
  const broadcastRef = useRef<(event: string, payload: unknown) => void>(() => {})
  const dragRef = useRef<DragState | null>(null)
  const dragAnimationFrameRef = useRef<number | null>(null)
  const pendingDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const dragLayerElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const dragPreviewPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragPreviewBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const touchGestureRef = useRef<TouchGestureState | null>(null)
  const panRef = useRef(pan)
  const chatUserRef = useRef<ChatUser | null>(null)
  const chatCharactersRef = useRef<CharacterOption[]>([])
  const publishRollRef = useRef<(roll: RollMessage) => Promise<void>>(async () => {})
  const createQuickRollRef = useRef<ReturnType<typeof createQuickRollFactory>>(async () => {
    throw new Error('createQuickRoll is not ready')
  })
  const rollQuickDiceRef = useRef<(
    diceCount?: number,
    poolName?: string,
    characterOverride?: CharacterOption,
    poolType?: string,
    options?: QuickRollOptions,
  ) => Promise<void>>(async () => {})
  const poolRollSnapshotRef = useRef({
    selectedMasterRollCharacter: null as CharacterOption | null,
    masterRollDiceCount: 0,
    masterRollMode: 'normal' as RollMode,
    selectedMasterContestedOpponent: null as ContestedOpponentOption | null,
    masterRollPoolBeforeLimit: 0,
    masterRollPoolName: '',
    masterRollHidden: false,
    masterUseBloodSurge: false,
    masterRollAttribute: '',
    masterRollAttributeTwo: '',
    masterRollSkill: '',
    masterRollDiscipline: '',
    masterWillpowerImpairmentPenalty: 0,
    masterHealthImpairmentPenalty: 0,
    disabledMasterRollModifierIds: [] as string[],
    previewCharacter: null as CharacterOption | null,
    canRollPreview: false,
    previewDiceCount: 0,
    previewRollMode: 'normal' as RollMode,
    selectedPreviewContestedOpponent: null as ContestedOpponentOption | null,
    previewPoolBeforeLimit: 0,
    previewBloodSurgeEnabled: false,
    previewRollAttribute: '',
    previewRollAttributeTwo: '',
    previewRollSkill: '',
    previewRollDiscipline: '',
    previewAttributeDots: 0,
    previewAttributeTwoDots: 0,
    previewSkillDots: 0,
    previewDisciplineDots: 0,
    previewRollModifier: 0,
    previewWillpowerImpairmentPenalty: 0,
    previewHealthImpairmentPenalty: 0,
    disabledPreviewRollModifierIds: [] as string[],
  })
  const layerContextRef = useRef({
    currentSceneId: null as string | null,
    currentOwnerId: null as string | null,
    selectedLayer: null as TableLayer | null,
    tableRole: null as TableRole | null,
  })
  const selectedChatCharacterIdRef = useRef('')
  const journalEntriesRef = useRef<JournalEntry[]>([])


  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return
    folderInput.setAttribute('webkitdirectory', '')
    folderInput.setAttribute('directory', '')
  }, [])

  useEffect(() => {
    setPreviewCharacterTab('mechanics')
    setPreviewRollAttribute('')
    setPreviewRollAttributeTwo('')
    setPreviewRollSkill('')
    setPreviewRollDiscipline('')
    setPreviewRollModifier(0)
    setDisabledPreviewRollModifierIds([])
    setPreviewRollMode('normal')
    setPreviewContestedOpponentId('')
    setPreviewDisciplineName('')
    setPreviewPowerName('')
    setDisabledPreviewPowerModifierIds([])
    setPreviewUseBloodSurge(false)
    setQuickInventoryName('')
    setQuickInventoryCategory('Другое')
    setQuickInventoryQuantity(1)
    setQuickInventoryStatus('')
  }, [previewCharacter?.id])

  useEffect(() => {
    const shouldLoadDisciplineRules = Boolean(
      previewDisciplineName
      || previewCharacter?.id
      || selectedMasterRollCharacterId,
    )
    if (!shouldLoadDisciplineRules || disciplineRules) return
    const controller = new AbortController()
    setDisciplineRulesStatus('Загружаю описание дисциплины...')
    Promise.all([
      fetch('/rules.json', { signal: controller.signal }),
      fetch('/rules_eng.json', { signal: controller.signal }),
    ])
      .then(async ([ruResponse, enResponse]) => {
        if (!ruResponse.ok) throw new Error('rules.json не найден')
        const ruRules = await ruResponse.json() as { disciplines?: Record<string, DisciplineRule> }
        const enRules = enResponse.ok
          ? await enResponse.json() as { disciplines?: Record<string, DisciplineRule> }
          : {}
        return {
          ...(ruRules.disciplines || {}),
          ...(enRules.disciplines || {}),
        }
      })
      .then(disciplines => {
        setDisciplineRules(disciplines)
        setDisciplineRulesStatus('')
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Не удалось загрузить правила дисциплин:', error)
        setDisciplineRulesStatus('Не удалось загрузить описание дисциплины.')
      })
    return () => controller.abort()
  }, [previewDisciplineName, previewCharacter?.id, selectedMasterRollCharacterId, disciplineRules])

  const suppressNextContextMenuRef = useRef(false)
  const {
    chatMessages,
    chatStatus,
    chatUser,
    chatCharacters,
    setChatCharacters,
    selectedChatCharacterId,
    chooseActiveCharacter,
    chatAuthMode,
    setChatAuthMode,
    chatUsernameDraft,
    setChatUsernameDraft,
    chatPasswordDraft,
    setChatPasswordDraft,
    isChatBusy,
    chatPanelTab,
    setChatPanelTab,
    chatDraft,
    setChatDraft,
    handleChatAuth,
    logoutChat,
    sendChatMessage,
  } = useChat({ chronicleId: room })

  useEffect(() => () => {
    if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
  }, [])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    if (rollsStatus === 'error') setConnectionText('Нет общей истории')
    else if (rollsStatus === 'ok') setConnectionText('Онлайн')
  }, [rollsStatus])

  useEffect(() => {
    chatUserRef.current = chatUser
  }, [chatUser])

  useEffect(() => {
    chatCharactersRef.current = chatCharacters
  }, [chatCharacters])

  useEffect(() => {
    selectedChatCharacterIdRef.current = selectedChatCharacterId
  }, [selectedChatCharacterId])

  useEffect(() => {
    journalEntriesRef.current = journalEntries
  }, [journalEntries])

  const {
    voiceEnabled,
    voiceMuted,
    voiceStatus,
    voiceMasterVolume,
    voiceQuality,
    voiceParticipants,
    voiceAudioRefs,
    remoteStreamsRef,
    handleVoiceSignalRef,
    setVoiceMasterVolume,
    setVoiceQuality,
    setVoiceStatus,
    setVoiceParticipantVolume,
    startVoice,
    stopVoice,
    toggleVoiceMuted,
  } = useTableVoice({
    roomRef,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
    chatUserRef,
    chatCharactersRef,
    selectedChatCharacterIdRef,
    t,
  })

  useEffect(() => {
    if (!chatUser) {
      setSelectedMasterRollCharacterId('')
      return
    }
    if (!chatCharacters.length) {
      setSelectedMasterRollCharacterId('')
      return
    }

    const savedMasterRollId = window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}:${room}`)
      || window.localStorage.getItem(`vtm-master-roll-character:${chatUser.id}`)
    const savedIsValid = Boolean(savedMasterRollId && chatCharacters.some(character => character.id === savedMasterRollId))
    const fallbackId = selectedChatCharacterId && chatCharacters.some(character => character.id === selectedChatCharacterId)
      ? selectedChatCharacterId
      : chatCharacters[0]?.id || ''

    setSelectedMasterRollCharacterId(current => {
      const currentIsValid = Boolean(current && chatCharacters.some(character => character.id === current))
      const nextId = currentIsValid ? current : savedIsValid ? savedMasterRollId || '' : fallbackId
      if (nextId) {
        window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}:${room}`, nextId)
        window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}`, nextId)
      }
      return nextId
    })
  }, [chatCharacters, chatUser, room, selectedChatCharacterId])

  useEffect(() => {
    if (!layerContextMenu) return
    const closeMenu = () => setLayerContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('keydown', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('keydown', closeMenu)
    }
  }, [layerContextMenu])

  useEffect(() => {
    const handleHotkeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('library')
        window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-media-search]')?.focus(), 0)
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setRightRailTab('media')
        setMediaTab('layers')
        setRightPanelOpen(true)
      }
    }

    window.addEventListener('keydown', handleHotkeys)
    return () => window.removeEventListener('keydown', handleHotkeys)
  }, [])

  const getSelectedSceneId = () => selectedSceneId || activeSceneId || scenes[0]?.id || null

  const loadLayersForScene = async (targetRoom: string, sceneId: string) => {
    const result = await loadLayersForSceneCore(targetRoom, sceneId)
    setTableStatus(result.status)
  }

  const { channelRef, broadcast } = useTableRealtime({
    room,
    tf,
    chatUserRef,
    activeSceneIdRef,
    layersRef,
    setRolls,
    setLayers,
    setScenes,
    setSceneMusic,
    setActiveSceneId,
    setSelectedSceneId,
    setSelectedLayerId,
    setSelectedLayerIds,
    setConnectionText,
    setTableStatus,
    setHandNotice,
    setIncomingOpposedProposal,
    setRightRailTab,
    setRoomParticipants,
    setMasterReveals,
    setMasterWhispers,
    setZoom,
    setPan,
    loadLayersForScene,
    loadSceneMusic,
    ensureDefaultScene,
    onRollRef: triggerDiceOverlayRef,
    onVoiceSignalRef: handleVoiceSignalRef,
  })
  broadcastRef.current = broadcast

  const {
    patchLayer,
    patchLayers,
    patchSelectedLayers,
    addMediaLayer,
    createFolder,
    deleteLayer,
    moveLayersToFolder,
    createFolderForSelection,
    placeLayerOnTable,
    reorderLayers,
    deleteSelectedLayers,
    duplicateLayer,
    renameLayer,
    resetLayerCrop,
    createNamedFolder,
    copyLayerToPersonalMedia,
    setLayerSelection,
    canEditLayer,
  } = useLayerActions({
    room,
    t,
    tf,
    isMaster,
    chatUser,
    layers,
    layersRef,
    setLayers,
    setSelectedLayerId,
    setSelectedLayerIds,
    setTableStatus,
    setRightRailTab,
    setExpandedFolders,
    setLayerContextMenu,
    setMediaTab,
    broadcast: (event, payload) => broadcastRef.current(event, payload),
    journalEntriesRef,
    getLayerContext: () => layerContextRef.current,
  })

  const {
    updateCharacterHunger,
    updateCharacterHumanity,
    updateCharacterWillpower,
    updateCharacterHealth,
    syncHealthCharacter,
    applyCharacterHealthDamage,
    recoverCharacterHealth,
    addHumanityStains,
    performRemorseCheck,
    spendWillpower,
    recoverWillpower,
    adjustWillpowerStress,
    rollWillpowerCheck,
    performRouseCheck,
    rollRouseCheck,
    quenchHunger,
    mendVampireSuperficial,
    mendVampireAggravated,
    recoverMortalHealth,
    treatMortalHealth,
    getRollCharacter,
  } = useCharacterActions({
    room,
    t,
    tf,
    disciplineRules,
    defaultDisciplineRules,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    setChatCharacters,
    setPreviewCharacter,
    setConnectionText,
    broadcast,
    getChatCharacters: () => chatCharactersRef.current,
    publishRollRef,
    rollQuickDiceRef,
  })

  const {
    deactivatePreviewDisciplinePower: runDeactivatePreviewDisciplinePower,
    rollPreviewPower: runRollPreviewPower,
    removePreviewActiveEffect: runRemovePreviewActiveEffect,
  } = useDisciplineActions({
    room,
    t,
    tf,
    previewDisciplineName,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    setChatCharacters,
    setPreviewCharacter,
    setConnectionText,
    broadcast,
    publishRollRef,
    rollQuickDiceRef,
    addHumanityStains,
  })

  const {
    addQuickInventoryItem,
    showInventoryItemToMaster,
  } = useInventoryActions({
    room,
    t,
    tf,
    chatUser,
    selectedActiveCharacterId: selectedChatCharacterId,
    quickInventoryName,
    quickInventoryCategory,
    quickInventoryQuantity,
    isQuickInventoryBusy,
    setQuickInventoryName,
    setQuickInventoryQuantity,
    setQuickInventoryStatus,
    setIsQuickInventoryBusy,
    setChatCharacters,
    setPreviewCharacter,
    broadcast,
    getPreviewCharacter: () => previewCharacter,
  })

  const {
    rollMasterPool,
    rollMasterQuick,
    rollPreviewPool,
  } = usePoolRollActions({
    room,
    t,
    tf,
    d10,
    chatUser,
    isMaster,
    setConnectionText,
    broadcast,
    publishRollRef,
    rollQuickDiceRef,
    createQuickRollRef,
    getPoolRollSnapshot: () => poolRollSnapshotRef.current,
  })

  const createScene = async () => {
    if (!isMaster) return
    const name = window.prompt(t('Название сцены'), t('Новая сцена'))?.trim()
    if (!name) return
    const now = new Date().toISOString()
    const scene: TableScene = {
      id: createTableId(),
      room,
      name,
      thumbnailUrl: '',
      isActive: scenes.length === 0,
      createdBy: currentOwnerId,
      createdAt: now,
      updatedAt: now,
    }
    const { error } = await insertScene(scene)
    if (error) {
      console.error('Не удалось создать сцену:', error)
      setSceneStatus('Сцена не создана')
      return
    }
    setScenes(prev => upsertScene(prev, scene))
    setSelectedSceneId(scene.id)
    broadcast('scene', scene)
  }

  const renameScene = async () => {
    if (!isMaster || !selectedScene) return
    const name = window.prompt(t('Новое название сцены'), selectedScene.name)?.trim()
    if (!name || name === selectedScene.name) return
    const updatedAt = new Date().toISOString()
    const next = { ...selectedScene, name, updatedAt }
    setScenes(prev => upsertScene(prev, next))
    const { error } = await updateSceneRecord(selectedScene.id, { name, updated_at: updatedAt })
    if (error) {
      console.error('Не удалось переименовать сцену:', error)
      setSceneStatus('Название сцены не сохранилось')
      return
    }
    broadcast('scene', next)
  }

  const publishSceneTrack = async (track: SceneMusicTrack, options: { play?: boolean } = { play: true }) => {
    const now = new Date().toISOString()
    const provider = getMusicProvider(track.url)
    const youtube = provider === 'youtube' ? parseYouTubeUrl(track.url) : { videoId: '', playlistId: undefined }
    const payload = {
      room: roomRef.current,
      url: track.url,
      activeUri: provider === 'youtube' ? youtube.playlistId || youtube.videoId : track.url,
      isPlaying: Boolean(options.play),
      positionSeconds: 0,
      updatedAt: now,
      provider,
      playlistId: youtube.playlistId,
      playlistIndex: youtube.playlistId ? Math.max(0, track.orderIndex) : undefined,
      trackId: youtube.videoId || undefined,
      sourceType: provider,
    }
    await upsertTableMusicState(payload)
    window.dispatchEvent(new CustomEvent('vtm-music-state', { detail: payload }))
    broadcastMusicChannel(channelRef.current, 'music', payload)
  }

  const raiseHand = () => {
    const character = chatCharacters.find(item => item.id === selectedChatCharacterId)
    const name = character?.name || chatUser?.username || (isMaster ? t('Мастер') : t('Игрок'))
    const payload = { room, name, at: new Date().toISOString() }
    setHandNotice(tf('{name} поднял руку', { name }))
    window.setTimeout(() => setHandNotice(''), 5200)
    broadcast('hand-raise', payload)
  }

  const playSceneAutoplayMusic = async (sceneId: string) => {
    const tracks = sceneId === activeSceneIdRef.current
      ? sceneMusicRef.current
      : (await fetchSceneMusic(roomRef.current, sceneId)).tracks
    const track = sortSceneMusic(tracks).find(item => item.autoplay && item.isDefault) || sortSceneMusic(tracks).find(item => item.autoplay)
    if (!track?.url) return
    await publishSceneTrack(track, { play: true })
  }

  const activateScene = async (sceneId: string) => {
    if (!isMaster) return
    const scene = scenesRef.current.find(item => item.id === sceneId)
    if (!scene) return
    await deactivateOtherScenes(room, sceneId)
    const { error } = await activateSceneRecord(sceneId)
    if (error) {
      console.error('Не удалось переключить сцену:', error)
      setSceneStatus('Сцена не переключилась')
      return
    }
    setActiveSceneId(sceneId)
    activeSceneIdRef.current = sceneId
    setSelectedSceneId(sceneId)
    setScenes(prev => prev.map(item => ({ ...item, isActive: item.id === sceneId })))
    await loadLayersForScene(room, sceneId)
    await loadSceneMusic(room, sceneId)
    broadcast('scene-active', { room, sceneId })
    void playSceneAutoplayMusic(sceneId)
  }

  const deleteScene = async () => {
    if (!isMaster || !selectedScene) return
    if (scenes.length <= 1) {
      window.alert(t('Нельзя удалить единственную сцену.'))
      return
    }
    const ok = window.confirm(tf('Удалить сцену "{name}" вместе с её слоями, медиа и музыкой?', { name: selectedScene.name }))
    if (!ok) return
    const nextActive = selectedScene.isActive ? scenes.find(scene => scene.id !== selectedScene.id) : activeScene
    const { error } = await deleteSceneWithAssets(selectedScene.id)
    if (error) {
      console.error('Не удалось удалить сцену:', error)
      setSceneStatus('Сцена не удалена')
      return
    }
    setScenes(prev => prev.filter(scene => scene.id !== selectedScene.id))
    broadcast('scene-delete', { room, id: selectedScene.id, nextActiveSceneId: nextActive?.id })
    if (nextActive?.id && selectedScene.isActive) await activateScene(nextActive.id)
    else setSelectedSceneId(nextActive?.id || null)
  }

  const setSceneThumbnailFromSelection = async () => {
    if (!isMaster || !selectedScene) return
    const layer = layers.find(item => selectedLayerIds.has(item.id) && item.layerType === 'image')
    if (!layer) {
      window.alert(t('Выдели картинку на активной сцене, чтобы сделать её preview.'))
      return
    }
    const updatedAt = new Date().toISOString()
    const next = { ...selectedScene, thumbnailUrl: layer.imageData, updatedAt }
    setScenes(prev => upsertScene(prev, next))
    await updateSceneRecord(selectedScene.id, { thumbnail_url: layer.imageData, updated_at: updatedAt })
    broadcast('scene', next)
  }

  const saveSelectionAsGroup = async () => {
    if (!isMaster || selectedLayerIds.size === 0) return
    const name = window.prompt(t('Название группы'), t('Группа сцены'))?.trim()
    if (!name) return
    const folderId = await createFolder(null, name, true, false)
    if (!folderId) return
    const selected = [...selectedLayerIds]
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
      .filter(layer => layer.layerType !== 'folder')
    for (const [index, layer] of selected.entries()) {
      const createdId = await addMediaLayer(
        layer.imageData,
        layer.name,
        { width: layer.width, height: layer.height },
        layer.layerType === 'folder' ? 'file' : layer.layerType,
        index,
        { x: layer.x, y: layer.y },
        false
      )
      if (createdId) await patchLayer(createdId, { parentId: folderId })
    }
    setExpandedFolders(prev => new Set(prev).add(folderId))
  }

  const fetchYouTubeTitle = async (url: string): Promise<string | null> => {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const response = await fetch(oembedUrl)
      if (!response.ok) return null
      const data = await response.json() as { title?: string }
      return data.title || null
    } catch {
      return null
    }
  }

  const addSceneMusic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isMaster || !selectedScene) return
    const urls = sceneMusicDraft.split(/\s+/).map(item => item.trim()).filter(Boolean)
    if (urls.length === 0) return
    const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
    for (const [index, url] of urls.entries()) {
      const now = new Date().toISOString()
      const provider = getMusicProvider(url)
      const defaultTitle = tf('Трек {n}', { n: baseOrder + index + 2 })
      const youtubeTitle = provider === 'youtube' ? await fetchYouTubeTitle(url) : null
      const track: SceneMusicTrack = {
        id: createTableId(),
        room,
        sceneId: selectedScene.id,
        title: youtubeTitle || defaultTitle,
        url,
        sourceType: provider,
        orderIndex: baseOrder + index + 1,
        isDefault: selectedSceneMusic.length === 0 && index === 0,
        autoplay: selectedSceneMusic.length === 0 && index === 0,
        createdAt: now,
        updatedAt: now,
      }
      const { error } = await insertSceneMusic(track)
      if (!error) {
        setSceneMusic(prev => sortSceneMusic([...prev, track]))
        broadcast('scene-music', track)
      }
    }
    setSceneMusicDraft('')
  }

  const patchSceneMusic = async (track: SceneMusicTrack, patch: Partial<SceneMusicTrack>) => {
    if (!isMaster) return
    const updatedAt = new Date().toISOString()
    const next = { ...track, ...patch, updatedAt }
    let nextTracks = sceneMusicRef.current.map(item => (item.id === track.id ? next : item))
    if (patch.isDefault) {
      nextTracks = nextTracks.map(item => item.sceneId === track.sceneId ? { ...item, isDefault: item.id === track.id } : item)
      await clearSceneMusicDefaults(track.sceneId, track.id)
    }
    setSceneMusic(sortSceneMusic(nextTracks))
    const { error } = await updateSceneMusicRecord(track.id, {
      title: next.title,
      url: next.url,
      source_type: next.sourceType,
      order_index: next.orderIndex,
      is_default: next.isDefault,
      autoplay: next.autoplay,
      updated_at: updatedAt,
    })
    if (error) console.error('Не удалось обновить музыку сцены:', error)
    broadcast('scene-music', next)
  }

  const renameSceneMusic = async (track: SceneMusicTrack) => {
    const title = window.prompt(t('Название трека'), track.title)?.trim()
    if (!title || title === track.title) return
    await patchSceneMusic(track, { title })
  }

  const deleteSceneMusic = async (track: SceneMusicTrack) => {
    if (!isMaster) return
    setSceneMusic(prev => prev.filter(item => item.id !== track.id))
    await deleteSceneMusicRecord(track.id)
    broadcast('scene-music-delete', { room, sceneId: track.sceneId, id: track.id })
  }

  const uploadSceneMusicFiles = async (files: FileList | File[]) => {
    if (!isMaster || !selectedScene) return
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'))
    if (audioFiles.length === 0) {
      window.alert(t('Для музыки сцены можно загрузить только аудиофайлы.'))
      return
    }

    setIsUploading(true)
    try {
      const baseOrder = selectedSceneMusic.reduce((max, track) => Math.max(max, track.orderIndex), -1)
      for (const [index, file] of audioFiles.entries()) {
        const { error: uploadError, publicUrl, id } = await uploadSceneMusicAudioFile(
          room,
          selectedScene.id,
          file,
          index,
        )

        if (uploadError || !publicUrl || !id) {
          console.error('Не удалось загрузить музыку сцены:', uploadError)
          window.alert(t('Аудиофайл не загрузился. Проверь bucket table-music и policies из SQL.'))
          continue
        }

        const now = new Date().toISOString()
        const track: SceneMusicTrack = {
          id,
          room,
          sceneId: selectedScene.id,
          title: file.name,
          url: publicUrl,
          sourceType: 'file',
          orderIndex: baseOrder + index + 1,
          isDefault: selectedSceneMusic.length === 0 && index === 0,
          autoplay: selectedSceneMusic.length === 0 && index === 0,
          createdAt: now,
          updatedAt: now,
        }

        const { error } = await insertSceneMusic(track)

        if (!error) {
          setSceneMusic(prev => sortSceneMusic([...prev, track]))
          broadcast('scene-music', track)
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleSceneMusicUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadSceneMusicFiles(event.target.files)
      event.target.value = ''
    }
  }

  const reorderSceneMusic = async (track: SceneMusicTrack, direction: 'up' | 'down') => {
    const tracks = sortSceneMusic(selectedSceneMusic)
    const index = tracks.findIndex(item => item.id === track.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const swap = tracks[swapIndex]
    if (!swap) return
    await patchSceneMusic(track, { orderIndex: swap.orderIndex })
    await patchSceneMusic(swap, { orderIndex: track.orderIndex })
  }

  const selectedActiveCharacter = chatCharacters.find(item => item.id === selectedChatCharacterId) || null
  const selectedMasterRollCharacter = chatCharacters.find(item => item.id === selectedMasterRollCharacterId) || selectedActiveCharacter
  const journalStorageKey = chatUser ? `vtm-journal:${chatUser.id}:${room}` : ''
  const selectedJournalEntry = journalEntries.find(entry => entry.id === selectedJournalEntryId) || journalEntries[0] || null
  const filteredJournalEntries = journalEntries.filter(entry => {
    const query = journalSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.title} ${entry.text}`.toLowerCase().includes(query)
  })
  const masterChatPlayers = roomParticipants.filter(participant => participant.userId !== chatUser?.id)
  const getContestedOpponentOptions = (initiator: CharacterOption | null) => {
    const options: ContestedOpponentOption[] = []
    const seen = new Set<string>()
    const addOption = (option: ContestedOpponentOption) => {
      if (seen.has(option.id)) return
      seen.add(option.id)
      options.push(option)
    }

    roomParticipants
      .filter(participant => participant.userId !== chatUser?.id && participant.characterId !== initiator?.id)
      .forEach(participant => {
        const characterName = participant.characterId && participant.characterName !== 'без персонажа'
          ? `${participant.characterName} · `
          : ''
        addOption({
          id: `player:${participant.userId}`,
          label: `${characterName}${participant.username}`,
          actorKind: 'player',
          characterId: participant.characterId,
          userId: participant.userId,
        })
      })

    if (isMaster) {
      chatCharacters.forEach(character => {
        if (character.id === initiator?.id) return
        addOption({
          id: `npc:${character.id}`,
          label: tf('{name} · НПС', { name: character.name }),
          actorKind: 'npc',
          characterId: character.id,
        })
      })
    }

    return options
  }
  const visibleMasterWhispers = masterWhispers.filter(message => {
    if (!chatUser) return false
    if (isMaster) return !selectedMasterChatUserId
      ? true
      : message.fromUserId === selectedMasterChatUserId || message.toUserId === selectedMasterChatUserId
    return message.fromUserId === chatUser.id || message.toUserId === chatUser.id
  })
  const getSkillDots = (value: unknown) => getSkillDotValue(value)
  const getSkillSpecs = (value: unknown) => {
    if (!value || typeof value !== 'object') return []
    const specs = (value as { specs?: unknown }).specs
    return Array.isArray(specs) ? specs.filter((spec): spec is string => typeof spec === 'string') : []
  }
  const getDisciplineDots = (sources: Record<string, number>) => Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)

  const masterRollAttributeDots = selectedMasterRollCharacter ? getAttributeDots(selectedMasterRollCharacter.attributes, masterRollAttribute) : 0
  const masterRollAttributeTwoDots = selectedMasterRollCharacter ? getAttributeDots(selectedMasterRollCharacter.attributes, masterRollAttributeTwo) : 0
  const masterRollSkillDots = selectedMasterRollCharacter ? getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, masterRollSkill)) : 0
  const masterRollDisciplineDots = selectedMasterRollCharacter ? getDisciplineDots(selectedMasterRollCharacter.disciplines[masterRollDiscipline] || {}) : 0
  const masterRollPoolBeforeLimit = masterRollAttributeDots + masterRollAttributeTwoDots + masterRollSkillDots + masterRollDisciplineDots + masterRollModifier
  const masterWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty([masterRollAttribute, masterRollAttributeTwo], selectedMasterRollCharacter)
  const masterHealthImpairmentPenalty = tableHealth().getHealthImpairmentPenalty([masterRollAttribute, masterRollAttributeTwo], getCharacterHealth(selectedMasterRollCharacter))
  const masterRollEffectResult = selectedMasterRollCharacter
    ? tableApplyDisciplineEffectsToRoll({
        characterData: selectedMasterRollCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: masterRollPoolBeforeLimit,
        poolType: 'master-character',
        kind: 'roll',
        action: masterRollMode,
        source: masterUseBloodSurge ? 'blood_surge' : 'manual',
        traits: getRollTraits(masterRollAttribute, masterRollAttributeTwo, masterRollSkill, masterRollDiscipline),
        penalties: getRollPenalties(t,masterWillpowerImpairmentPenalty, masterHealthImpairmentPenalty),
        disabledModifierIds: disabledMasterRollModifierIds,
      }, selectedMasterRollCharacter.derivedStats)
    : null
  const masterRollDiceCount = masterRollEffectResult?.finalDiceCount || 0
  const masterBloodPotency = getCharacterBloodPotency(selectedMasterRollCharacter)
  const masterBloodSurgeBonus = getBloodSurgeBonus(masterBloodPotency)
  const masterRollExtraAttributes = selectedMasterRollCharacter ? getExtraTraitNames(selectedMasterRollCharacter.attributes, ATTRIBUTE_GROUPS) : []
  const masterRollExtraSkills = selectedMasterRollCharacter ? getExtraTraitNames(selectedMasterRollCharacter.skills, SKILL_GROUPS) : []
  const masterRollDisciplineNames = selectedMasterRollCharacter
    ? Array.from(new Set([
        ...Object.keys(selectedMasterRollCharacter.disciplines),
        ...Object.keys(selectedMasterRollCharacter.selectedPowers),
        ...Object.keys(selectedMasterRollCharacter.selectedPathPowers),
      ])).sort((a, b) => a.localeCompare(b, 'ru'))
    : []
  const masterRollPoolParts = [
    masterRollAttribute ? `${t(masterRollAttribute)} ${masterRollAttributeDots}` : '',
    masterRollAttributeTwo ? `${t(masterRollAttributeTwo)} ${masterRollAttributeTwoDots}` : '',
    masterRollSkill ? `${t(masterRollSkill)} ${masterRollSkillDots}` : '',
    masterRollDiscipline ? `${masterRollDiscipline} ${masterRollDisciplineDots}` : '',
    masterRollModifier ? `${t('модификатор')} ${masterRollModifier > 0 ? '+' : ''}${masterRollModifier}` : '',
  ].filter(Boolean)
  const masterRollPoolName = masterRollPoolParts.join(' + ') || d10(masterRollDiceCount || 1)
  const masterRollHidden = masterRollVisibility === 'hidden'
  const masterContestedOpponentOptions = getContestedOpponentOptions(selectedMasterRollCharacter)
  const selectedMasterContestedOpponent = masterContestedOpponentOptions.find(option => option.id === masterContestedOpponentId) || null

  useEffect(() => {
    if (!incomingOpposedProposal) return
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }, [incomingOpposedProposal?.id, selectedActiveCharacter?.id])

  const previewAttributeDots = previewCharacter ? getAttributeDots(previewCharacter.attributes, previewRollAttribute) : 0
  const previewAttributeTwoDots = previewCharacter ? getAttributeDots(previewCharacter.attributes, previewRollAttributeTwo) : 0
  const previewSkillDots = previewCharacter ? getSkillDots(resolveSkillValue(previewCharacter.skills, previewRollSkill)) : 0
  const previewDisciplineDots = previewCharacter ? getDisciplineDots(previewCharacter.disciplines[previewRollDiscipline] || {}) : 0
  const previewPoolBeforeLimit = previewAttributeDots + previewAttributeTwoDots + previewSkillDots + previewDisciplineDots + previewRollModifier
  const previewWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty([previewRollAttribute, previewRollAttributeTwo], previewCharacter)
  const previewHealth = getCharacterHealth(previewCharacter)
  const previewSheetFixed = previewCharacter?.sheetFixed ?? true
  const previewHealthImpairmentPenalty = tableHealth().getHealthImpairmentPenalty([previewRollAttribute, previewRollAttributeTwo], previewHealth)
  const previewRollEffectResult = previewCharacter
    ? tableApplyDisciplineEffectsToRoll({
        characterData: previewCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: previewPoolBeforeLimit,
        poolType: 'character-sheet',
        kind: 'roll',
        action: previewRollMode,
        source: previewUseBloodSurge ? 'blood_surge' : 'manual',
        traits: getRollTraits(previewRollAttribute, previewRollAttributeTwo, previewRollSkill, previewRollDiscipline),
        penalties: getRollPenalties(t,previewWillpowerImpairmentPenalty, previewHealthImpairmentPenalty),
        disabledModifierIds: disabledPreviewRollModifierIds,
      }, previewCharacter.derivedStats)
    : null
  const previewDiceCount = previewRollEffectResult?.finalDiceCount || 0
  const previewBloodPotency = getCharacterBloodPotency(previewCharacter)
  const previewBloodSurgeBonus = getBloodSurgeBonus(previewBloodPotency)
  const previewHunger = getCharacterHunger(previewCharacter)
  const previewWillpower = getCharacterWillpower(previewCharacter)
  const previewHealthDerived = previewCharacter?.derivedStats.health
  const previewWillpowerDerived = previewCharacter?.derivedStats.willpower
  const previewDamageProfile = getCharacterDamageProfile(previewCharacter)
  const previewUsesVampireResources = Boolean(previewCharacter && ['vampire', 'thinblood'].includes(previewCharacter.characterType))
  const previewBloodSurgeEnabled = previewUsesVampireResources && previewUseBloodSurge
  const previewHumanity = previewCharacter?.humanity || {
    value: 7,
    stains: 0,
    stainEvents: [],
    lastRemorseCheckAt: null,
    lastHumanityLossAt: null,
    freeBoxes: 3,
    status: 'normal' as const,
  }
  const canRollPreview = Boolean(previewCharacter?.id && (isMaster || previewCharacter.id === selectedActiveCharacter?.id))
  const previewContestedOpponentOptions = getContestedOpponentOptions(previewCharacter)
  const selectedPreviewContestedOpponent = previewContestedOpponentOptions.find(option => option.id === previewContestedOpponentId) || null
  const canEditPreviewInventory = Boolean(chatUser && previewCharacter?.id && previewCharacter.id === selectedActiveCharacter?.id)
  const canEditPreviewActiveEffects = canEditPreviewInventory
  const previewExtraAttributes = previewCharacter ? getExtraTraitNames(previewCharacter.attributes, ATTRIBUTE_GROUPS) : []
  const previewExtraSkills = previewCharacter ? getExtraTraitNames(previewCharacter.skills, SKILL_GROUPS) : []
  const previewDisciplineNames = previewCharacter
    ? Array.from(new Set([
        ...Object.keys(previewCharacter.disciplines),
        ...Object.keys(previewCharacter.selectedPowers),
        ...Object.keys(previewCharacter.selectedPathPowers),
      ])).sort((a, b) => a.localeCompare(b, 'ru'))
    : []
  const previewDisciplineRule = previewDisciplineName && disciplineRules ? disciplineRules[previewDisciplineName] : undefined
  const previewOpenedDisciplineDots = previewCharacter && previewDisciplineName
    ? getDisciplineDots(previewCharacter.disciplines[previewDisciplineName] || {})
    : 0
  const previewLearnedPathPowers = previewCharacter && previewDisciplineName
    ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName])
    : {}
  const previewLearnedPowers = previewCharacter && previewDisciplineName
    ? getStandaloneSelectedPowerNames(
        previewCharacter.selectedPowers[previewDisciplineName],
        previewCharacter.selectedPathPowers[previewDisciplineName],
      )
    : []
  const allPreviewDisciplinePowers = getDisciplinePowerEntries(previewDisciplineRule)
  const hasPreviewLearnedPathPowers = hasSelectedPathPowers(previewLearnedPathPowers)
  const previewDisciplinePowers = previewLearnedPowers.length || hasPreviewLearnedPathPowers
    ? allPreviewDisciplinePowers.filter(power => isPowerEntrySelected(
        power,
        previewLearnedPowers,
        previewLearnedPathPowers,
      ))
    : allPreviewDisciplinePowers.filter(power => power.level <= (
        previewCharacter && previewDisciplineName
          ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
          : previewOpenedDisciplineDots
      ))
  const selectedPreviewPower = previewDisciplinePowers.find(power => getDisciplinePowerEntryKey(power) === previewPowerName) || null
  const selectedPreviewPowerRollFormula = getPowerRollFormula(selectedPreviewPower?.rule)
  const selectedPreviewPowerRollSummary = getPowerRollSummary(selectedPreviewPower?.rule, tf)
  const selectedPreviewPowerDifficultySummary = getPowerDifficultySummary(selectedPreviewPower?.rule, tf)
  const resolvedPreviewPowerPool = selectedPreviewPowerRollFormula && disciplineRules
    ? resolvePowerPool(selectedPreviewPowerRollFormula, disciplineRules)
    : selectedPreviewPowerRollFormula
  const previewPowerPoolChoices = parsePowerPool(resolvedPreviewPowerPool, previewDisciplineNames)
  const previewPowerOpposition = resolvedPreviewPowerPool.split(/\s+(?:vs\.?|против)\s+/i)[1]?.trim() || ''
  const previewPowerPoolBeforeLimit = previewCharacter
    ? previewPowerPoolSelections.reduce((sum, name) => sum + getCharacterPoolPartDots(previewCharacter, name), 0) + previewPowerModifier
    : 0
  const previewPowerWillpowerImpairmentPenalty = getWillpowerImpairmentPenalty(previewPowerPoolSelections, previewCharacter)
  const previewPowerHealthImpairmentPenalty = tableHealth().getHealthImpairmentPenalty(previewPowerPoolSelections, previewHealth)
  const previewPowerRollEffectResult = previewCharacter
    ? tableApplyDisciplineEffectsToRoll({
        characterData: previewCharacter,
        rulesJson: disciplineRules,
        baseDiceCount: previewPowerPoolBeforeLimit,
        poolType: 'discipline-power',
        kind: 'roll',
        action: selectedPreviewPower?.name || 'discipline-power',
        source: 'discipline',
        traits: getRollTraits(...previewPowerPoolSelections, previewDisciplineName),
        penalties: getRollPenalties(t,previewPowerWillpowerImpairmentPenalty, previewPowerHealthImpairmentPenalty),
        disabledModifierIds: disabledPreviewPowerModifierIds,
      }, previewCharacter.derivedStats)
    : null
  const previewPowerDiceCount = previewPowerRollEffectResult?.finalDiceCount || 0
  const selectedPreviewPowerCost = tableDisciplines().resolveDisciplineCost({
    mechanics: selectedPreviewPower?.rule.mechanics,
    legacyCost: selectedPreviewPower?.rule.cost,
  })
  const selectedPreviewPowerCostLabel = getDisciplineCostLabel(
    selectedPreviewPowerCost,
    selectedPreviewPower?.rule.cost,
    t,
    tf,
  )
  const selectedPreviewPowerInputFields = getDisciplinePowerInputFields(
    selectedPreviewPower?.rule.mechanics,
  )
  const selectedPreviewPowerManualPrompts = getDisciplineManualPrompts(
    selectedPreviewPower?.rule.mechanics,
  )
  const hasMissingPreviewPowerInput = selectedPreviewPowerInputFields.some(
    field => field.required && !previewPowerInputValues[field.id]?.trim(),
  )
  const selectedPreviewPowerIsActiveKind = selectedPreviewPower?.rule.mechanics?.activation?.kind === 'active'
  const selectedPreviewPowerIsActive = Boolean(
    previewCharacter
    && selectedPreviewPower
    && selectedPreviewPowerIsActiveKind
    && tableDisciplines().isDisciplinePowerActive(
      previewCharacter,
      selectedPreviewPower.rule.mechanics || {},
      {
        discipline: previewDisciplineName,
        path: selectedPreviewPower.path,
        power: selectedPreviewPower.name,
        level: selectedPreviewPower.level,
      },
    ),
  )

  poolRollSnapshotRef.current = {
    selectedMasterRollCharacter,
    masterRollDiceCount,
    masterRollMode,
    selectedMasterContestedOpponent,
    masterRollPoolBeforeLimit,
    masterRollPoolName,
    masterRollHidden,
    masterUseBloodSurge,
    masterRollAttribute,
    masterRollAttributeTwo,
    masterRollSkill,
    masterRollDiscipline,
    masterWillpowerImpairmentPenalty,
    masterHealthImpairmentPenalty,
    disabledMasterRollModifierIds,
    previewCharacter,
    canRollPreview,
    previewDiceCount,
    previewRollMode,
    selectedPreviewContestedOpponent,
    previewPoolBeforeLimit,
    previewBloodSurgeEnabled,
    previewRollAttribute,
    previewRollAttributeTwo,
    previewRollSkill,
    previewRollDiscipline,
    previewAttributeDots,
    previewAttributeTwoDots,
    previewSkillDots,
    previewDisciplineDots,
    previewRollModifier,
    previewWillpowerImpairmentPenalty,
    previewHealthImpairmentPenalty,
    disabledPreviewRollModifierIds,
  }

  useEffect(() => {
    if (!previewDisciplineName || !disciplineRules) return
    const disciplineRule = disciplineRules[previewDisciplineName]
    const allPowers = getDisciplinePowerEntries(disciplineRule)
    const learnedPathPowers = previewCharacter ? getSelectedPathPowerNames(previewCharacter.selectedPathPowers[previewDisciplineName]) : {}
    const learnedPowers = previewCharacter
      ? getStandaloneSelectedPowerNames(
          previewCharacter.selectedPowers[previewDisciplineName],
          previewCharacter.selectedPathPowers[previewDisciplineName],
        )
      : []
    const hasLearnedPathPowers = hasSelectedPathPowers(learnedPathPowers)
    const visiblePowers = learnedPowers.length || hasLearnedPathPowers
      ? allPowers.filter(power => isPowerEntrySelected(
          power,
          learnedPowers,
          learnedPathPowers,
        ))
      : allPowers.filter(power => power.level <= (
          previewCharacter
            ? getDisciplinePowerDots(previewCharacter, previewDisciplineName, power.path)
            : previewOpenedDisciplineDots
        ))
    setPreviewPowerName(current => visiblePowers.some(power => getDisciplinePowerEntryKey(power) === current) ? current : visiblePowers[0] ? getDisciplinePowerEntryKey(visiblePowers[0]) : '')
  }, [previewDisciplineName, disciplineRules, previewCharacter, previewOpenedDisciplineDots])

  useEffect(() => {
    setPreviewPowerPoolSelections(previewPowerPoolChoices.map(choice => choice.options[0] || ''))
    setPreviewPowerModifier(0)
    setDisabledPreviewPowerModifierIds([])
    setPreviewPowerInputValues({})
  }, [previewPowerName, resolvedPreviewPowerPool])

  useEffect(() => {
    setMasterRollAttribute('')
    setMasterRollAttributeTwo('')
    setMasterRollSkill('')
    setMasterRollDiscipline('')
    setMasterRollModifier(0)
    setDisabledMasterRollModifierIds([])
    setMasterRollMode('normal')
    setMasterContestedOpponentId('')
  }, [selectedMasterRollCharacterId])

  const saveJournalEntries = (entries: JournalEntry[], status = 'Сохранено') => {
    setJournalEntries(entries)
    if (journalStorageKey) window.localStorage.setItem(journalStorageKey, JSON.stringify(entries))
    setJournalSaveStatus(status)
  }

  const createJournalEntry = () => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: t('Новая запись'),
      text: '',
      createdAt: now,
      updatedAt: now,
    }
    saveJournalEntries([entry, ...journalEntries], 'Сохранено')
    setSelectedJournalEntryId(entry.id)
  }

  const updateJournalEntry = (patch: Partial<Pick<JournalEntry, 'title' | 'text'>>) => {
    if (!selectedJournalEntry) return
    const now = new Date().toISOString()
    const next = journalEntries.map(entry => entry.id === selectedJournalEntry.id ? { ...entry, ...patch, updatedAt: now } : entry)
    setJournalEntries(next)
    setJournalSaveStatus('Есть несохранённые изменения')
  }

  const persistCurrentJournal = () => {
    if (!journalStorageKey) return
    window.localStorage.setItem(journalStorageKey, JSON.stringify(journalEntries))
    setJournalSaveStatus('Сохранено')
  }

  const deleteJournalEntry = () => {
    if (!selectedJournalEntry) return
    if (!window.confirm(tf('Удалить запись "{title}"?', { title: selectedJournalEntry.title || t('Без названия') }))) return
    const next = journalEntries.filter(entry => entry.id !== selectedJournalEntry.id)
    saveJournalEntries(next, 'Сохранено')
    setSelectedJournalEntryId(next[0]?.id || '')
  }

  const chooseMasterRollCharacter = (characterId: string) => {
    setSelectedMasterRollCharacterId(characterId)
    if (!chatUser) return
    window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}:${room}`, characterId)
    window.localStorage.setItem(`vtm-master-roll-character:${chatUser.id}`, characterId)
  }

  const openCharacterPreview = async (character: CharacterOption, username?: string) => {
    setPreviewCharacter({ ...character, username: username || character.username })
    if (!character.id) return
    const { row, error } = await fetchCharacterById(character.id)
    if (error || !row) return
    const fresh = { ...mapCharacterRow(row), username: username || character.username }
    setPreviewCharacter(fresh)
    setChatCharacters(current => current.map(item => item.id === fresh.id ? { ...fresh, username: item.username || fresh.username } : item))
  }

  const openParticipantPreview = async (participant: ActiveParticipant) => {
    const local = chatCharacters.find(character => character.id === participant.characterId)
    if (local) {
      await openCharacterPreview(local, participant.username)
      return
    }
    if (!participant.characterId) {
      setPreviewCharacter({
        id: '',
        name: t('Без персонажа'),
        clan: null,
        image: '',
        username: participant.username,
        characterType: 'vampire',
        inventory: [],
        attributes: {},
        skills: {},
        disciplines: {},
        selectedPowers: {},
        selectedPathPowers: {},
        derivedStats: tableGetDerivedStats({}, {}),
        activeEffects: [],
      })
      return
    }
    const { row, error } = await fetchCharacterById(participant.characterId)
    if (error || !row) {
      setPreviewCharacter({
        id: participant.characterId,
        name: participant.characterName === 'без персонажа' ? t('без персонажа') : participant.characterName,
        clan: participant.characterClan,
        image: participant.characterImage,
        username: participant.username,
        characterType: 'vampire',
        inventory: [],
        attributes: {},
        skills: {},
        disciplines: {},
        selectedPowers: {},
        selectedPathPowers: {},
        derivedStats: tableGetDerivedStats({}, {}),
        activeEffects: [],
      })
      return
    }
    setPreviewCharacter({ ...mapCharacterRow(row), username: participant.username })
  }

  const updateOpposedResponseSide = (patch: Partial<RollPoolBuilder>) => {
    setOpposedResponseSide(current => ({ ...current, ...patch }))
  }

  const getOpposedCharacterPool = (character: CharacterOption | null, sideState: RollPoolBuilder) => {
    const attributeDots = character ? getAttributeDots(character.attributes, sideState.attribute) : 0
    const attributeTwoDots = character ? getAttributeDots(character.attributes, sideState.attributeTwo) : 0
    const skillDots = character ? getSkillDots(resolveSkillValue(character.skills, sideState.skill)) : 0
    const disciplineDots = character ? getDisciplineDots(character.disciplines[sideState.discipline] || {}) : 0
    const willpowerPenalty = getWillpowerImpairmentPenalty([sideState.attribute, sideState.attributeTwo], character)
    const healthPenalty = tableHealth().getHealthImpairmentPenalty([sideState.attribute, sideState.attributeTwo], getCharacterHealth(character))
    const baseDiceCount = attributeDots + attributeTwoDots + skillDots + disciplineDots + sideState.modifier
    const rollEffectResult = character
      ? tableApplyDisciplineEffectsToRoll({
          characterData: character,
          rulesJson: disciplineRules,
          baseDiceCount,
          poolType: 'opposed-response',
          kind: 'roll',
          action: 'contested',
          source: 'manual',
          traits: getRollTraits(sideState.attribute, sideState.attributeTwo, sideState.skill, sideState.discipline),
          penalties: getRollPenalties(t,willpowerPenalty, healthPenalty),
        }, character.derivedStats)
      : null
    const diceCount = rollEffectResult?.finalDiceCount || 0
    const poolParts = [
      sideState.attribute ? `${t(sideState.attribute)} ${attributeDots}` : '',
      sideState.attributeTwo ? `${t(sideState.attributeTwo)} ${attributeTwoDots}` : '',
      sideState.skill ? `${t(sideState.skill)} ${skillDots}` : '',
      sideState.discipline ? `${sideState.discipline} ${disciplineDots}` : '',
      sideState.modifier ? `${t('модификатор')} ${sideState.modifier > 0 ? '+' : ''}${sideState.modifier}` : '',
      willpowerPenalty ? t('Истощение Воли -2') : '',
      healthPenalty ? t('Изнурение по здоровью -2') : '',
    ].filter(Boolean)

    return {
      diceCount,
      poolName: poolParts.join(' + ') || d10(diceCount || 0),
      poolParts,
      rollEffectResult,
      extraAttributes: character ? getExtraTraitNames(character.attributes, ATTRIBUTE_GROUPS) : [],
      extraSkills: character ? getExtraTraitNames(character.skills, SKILL_GROUPS) : [],
      disciplineNames: character
        ? Array.from(new Set([
            ...Object.keys(character.disciplines),
            ...Object.keys(character.selectedPowers),
            ...Object.keys(character.selectedPathPowers),
          ])).sort((a, b) => a.localeCompare(b, 'ru'))
        : [],
    }
  }

  const queueDiceOverlayRoll = (overlayRoll: DiceOverlayRoll) => {
    setDiceOverlayQueue(prev => [...prev, overlayRoll])
  }

  const buildDiceOverlaySummary = (successes: number, meta?: RollMeta) => {
    if (meta?.bestialFailure) return { text: t('Звериный провал'), tone: 'bad' as const }
    if (meta?.messyCritical) return { text: tf('Грязный критический успех · {n}', { n: successes }), tone: 'good' as const }
    if (successes > 0) return { text: tf('Успехов: {n}', { n: successes }), tone: 'good' as const }
    return { text: t('Провал'), tone: 'bad' as const }
  }

  // Fires the 3D overlay for any freshly-arrived roll, own or remote. Dedupes by roll id so the
  // broadcast listener and the postgres_changes listener never show the same roll twice, and so a
  // contested-roll request (dice already rolled, but deliberately hidden until answered) only
  // animates once it resolves into `roll.opposed` — never at the moment the request is sent.
  const triggerDiceOverlay = (roll: RollMessage) => {
    if (shownDiceOverlayIdsRef.current.has(roll.id)) return
    if (roll.meta?.rollMode === 'contested' && roll.meta.contested?.status !== 'resolved' && !roll.opposed) return

    if (roll.opposed) {
      const totalDice = roll.opposed.sides.reduce((sum, side) => sum + side.dice.length, 0)
      if (totalDice === 0) return
      shownDiceOverlayIdsRef.current.add(roll.id)
      const groups: DiceOverlayGroup[] = roll.opposed.sides.map(side => ({
        key: side.id,
        label: `${side.actorName} · ${t(side.poolName)}`,
        dice: side.dice.map(die => ({ value: die.value, kind: die.kind })),
      }))
      queueDiceOverlayRoll({
        id: roll.id,
        title: t(roll.poolName),
        groups,
        summary: roll.opposed.summary,
        summaryTone: roll.opposed.winnerSideId ? 'good' : 'neutral',
      })
      return
    }

    if (!roll.dice.length) return
    shownDiceOverlayIdsRef.current.add(roll.id)
    const summary = buildDiceOverlaySummary(roll.successes, roll.meta)
    queueDiceOverlayRoll({
      id: roll.id,
      title: `${roll.characterName} · ${t(roll.poolName)}`,
      groups: [{ key: 'main', label: '', dice: roll.dice.map(die => ({ value: die.value, kind: die.kind })) }],
      summary: summary.text,
      summaryTone: summary.tone,
    })
  }
  triggerDiceOverlayRef.current = triggerDiceOverlay

  const publishRoll = async (roll: RollMessage) => {
    setRolls(prev => mergeRoll(prev, roll))
    triggerDiceOverlay(roll)
    if (roll.hidden) {
      setConnectionText('Скрытый бросок')
      return
    }

    broadcast('roll', roll)
    const { error } = await insertRollRecord(roll)

    if (error) setConnectionText('Бросок отправлен онлайн, но не сохранился')
    else setConnectionText('Онлайн')
  }
  publishRollRef.current = publishRoll

  const publishOpposedRoll = async (roll: RollMessage, opposed: OpposedRollResult) => {
    setRolls(prev => mergeRoll(prev, roll))
    triggerDiceOverlay(roll)
    broadcast('roll', roll)
    const { error } = await insertRollRecord(roll, opposed)
    if (error) setConnectionText('Встречная проверка отправлена онлайн, но не сохранилась')
    else setConnectionText('Онлайн')
  }

  const answerOpposedProposal = async () => {
    const proposal = incomingOpposedProposal
    if (!proposal || !chatUser || proposal.toUserId !== chatUser.id) return
    if (!selectedActiveCharacter) {
      window.alert(t('Сначала выбери активного персонажа.'))
      return
    }

    const responsePool = getOpposedCharacterPool(selectedActiveCharacter, opposedResponseSide)
    if (responsePool.diceCount < 1) {
      window.alert(t('Твой ответный пул должен быть хотя бы 1к10.'))
      return
    }

    const rightDice = rollsDice().rollD10Pool(responsePool.diceCount, getCharacterHunger(selectedActiveCharacter)) as Die[]
    const rightSide: OpposedRollSide = {
      id: 'right',
      actorName: selectedActiveCharacter.name || t('Ответчик'),
      actorKind: 'player',
      poolName: responsePool.poolName,
      diceCount: rightDice.length,
      dice: rightDice,
      successes: rollsDice().countD10Successes(rightDice),
    }
    const leftSide = proposal.initiator
    const responseRollModifiers = responsePool.rollEffectResult?.modifiers.filter(modifier => (
      modifier.active
      && (
        modifier.diceDelta !== 0
        || modifier.difficultyDelta !== 0
        || modifier.operation === 'ignore_penalty'
        || modifier.operation === 'auto_success'
      )
    ))
    const { roll, opposed } = buildAnsweredOpposedRoll({
      room,
      proposalId: proposal.id,
      leftSide,
      rightSide,
      opponentUserId: chatUser.id,
      opponentCharacterId: selectedActiveCharacter.id,
      responseRollModifiers,
      rollDifficultyModifier: responsePool.rollEffectResult?.difficultyDelta || undefined,
      warnings: getActiveRollModifierWarnings(responsePool.rollEffectResult),
      t,
      tf,
    })

    setIncomingOpposedProposal(null)
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
    await publishOpposedRoll(roll, opposed)
  }

  const dismissOpposedProposal = () => {
    setIncomingOpposedProposal(null)
    setOpposedResponseSide({ ...DEFAULT_OPPOSED_RESPONSE })
  }

  const createQuickRoll = createQuickRollFactory({
    room,
    isMaster,
    disciplineRules,
    rollsDice: rollsDice(),
    applyDisciplineEffectsToRoll: tableApplyDisciplineEffectsToRoll,
    performRouseCheck,
    getCharacterHunger,
    getCharacterWillpower,
    getCharacterBloodPotency,
    getCharacterHealth,
    getWillpowerMetaState,
  })
  createQuickRollRef.current = createQuickRoll

  const rollQuickDice = async (
    diceCount = 1,
    poolName = t('Быстрый бросок'),
    characterOverride?: CharacterOption,
    poolType = 'quick',
    options: QuickRollOptions = {},
  ) => {
    const character = characterOverride || selectedActiveCharacter
    if (!character) {
      window.alert(t('Сначала выбери активного персонажа.'))
      return
    }
    const roll = await createQuickRoll(diceCount, poolName, character, poolType, options)
    await publishRoll(roll)
  }
  rollQuickDiceRef.current = rollQuickDice

  const applyRollDamage = async (roll: RollMessage) => {
    if (!chatCharacters.length) {
      window.alert(t('На столе нет доступных целей.'))
      return
    }
    const targetList = chatCharacters.map((character, index) => `${index + 1}. ${character.name}`).join('\n')
    const targetIndex = Number(window.prompt(tf('Выбери цель:\n{list}', { list: targetList }), '1') || 0) - 1
    const target = chatCharacters[targetIndex]
    if (!target) return
    const sourceCharacter = getRollCharacter(roll)
    const opposedMargin = roll.opposed
      ? Math.abs((roll.opposed.sides[0]?.successes || 0) - (roll.opposed.sides[1]?.successes || 0))
      : roll.successes
    const margin = Math.max(0, Number(window.prompt(t('Разница успехов:'), String(opposedMargin)) || 0))
    const weaponModifier = Number(window.prompt(t('Модификатор оружия:'), '0') || 0)
    const severity: DamageSeverity = window.confirm(t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const amount = tableHealth().calculateConflictDamage({ margin, weaponModifier })
    if (amount < 1) {
      window.alert(t('Итоговый урон равен нулю.'))
      return
    }
    await applyCharacterHealthDamage(target, amount, severity, {
      source: 'physical_conflict',
      sourceCharacterData: sourceCharacter || undefined,
      attackType: 'physical_conflict',
      margin,
      weaponModifier,
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: [tf('Урон применён из броска «{poolName}».', { poolName: t(roll.poolName) })],
    })
  }

  const promptCharacterHealthDamage = async (character: CharacterOption) => {
    const amount = Math.max(0, Number(window.prompt(t('Сколько урона нанести?'), '1') || 0))
    if (amount < 1) return
    const severity: DamageSeverity = window.confirm(t('Нанести тяжёлый урон? Нажмите «Отмена» для лёгкого.'))
      ? 'aggravated'
      : 'superficial'
    const halveSuperficial = severity === 'superficial'
      ? window.confirm(t('Делить лёгкий урон пополам с округлением вверх?'))
      : false
    const note = window.prompt(t('Комментарий к урону (необязательно):'), '') || ''
    await applyCharacterHealthDamage(character, amount, severity, {
      source: 'manual',
      halveSuperficial,
      ignoreHalving: severity === 'superficial' && !halveSuperficial,
      notes: note ? [note] : [],
    })
  }

  const canUseWillpowerReroll = (roll: RollMessage) => {
    if (roll.opposed || (roll.hidden && !isMaster) || roll.meta?.willpowerReroll?.used || isWillpowerRerollExcluded(roll)) return false
    if (!getWillpowerRerollEligibleDieIds(roll).length) return false
    const character = getRollCharacter(roll)
    if (!character) return false
    const willpower = getCharacterWillpower(character)
    return willpower.max > 0 && willpower.aggravated < willpower.max
  }

  const toggleWillpowerRerollDie = (roll: RollMessage, dieId: string) => {
    if (!canUseWillpowerReroll(roll)) return
    setWillpowerRerollDraft(current => {
      const selected = current?.rollId === roll.id ? current.selectedDieIds : []
      if (selected.includes(dieId)) {
        return { rollId: roll.id, selectedDieIds: selected.filter(id => id !== dieId) }
      }
      if (selected.length >= 3) return { rollId: roll.id, selectedDieIds: selected }
      return { rollId: roll.id, selectedDieIds: [...selected, dieId] }
    })
  }

  const publishRollReplacement = async (roll: RollMessage) => {
    setRolls(prev => mergeRoll(prev, roll))
    broadcast('roll', roll)
    const { error } = await updateRollRecord(roll.id, roll)

    if (error) setConnectionText('Переброс отправлен онлайн, но не сохранился')
    else setConnectionText('Онлайн')
  }

  const confirmWillpowerReroll = async (roll: RollMessage) => {
    const draft = willpowerRerollDraft?.rollId === roll.id ? willpowerRerollDraft : null
    if (!draft || draft.selectedDieIds.length < 1) {
      window.alert(t('Выбери от одного до трёх обычных кубиков.'))
      return
    }
    const character = getRollCharacter(roll)
    if (!character) {
      window.alert(t('Не удалось найти персонажа для траты Воли.'))
      return
    }
    const spendResult = await spendWillpower(character, 1, tf('Воля: переброс · {poolName}', { poolName: t(roll.poolName) }))
    if (!spendResult) return

    const { rerolledDice, oldDice, newDice, successes, outcomeMeta } = applyWillpowerRerollToDice(
      roll,
      draft.selectedDieIds,
      rollsDice(),
      getRollDieId,
    )
    const previousWarnings = roll.meta?.warnings || []
    const updatedRoll: RollMessage = {
      ...roll,
      dice: rerolledDice,
      diceCount: rerolledDice.length,
      successes,
      meta: {
        ...(roll.meta || {}),
        characterId: character.id,
        willpowerBefore: getWillpowerMetaState(spendResult.before),
        willpowerAfter: getWillpowerMetaState(spendResult.after),
        spentWillpower: (roll.meta?.spentWillpower || 0) + spendResult.spent,
        willpowerImpaired: spendResult.after.impaired,
        willpowerReroll: {
          used: true,
          selectedDieIds: draft.selectedDieIds,
          oldDice,
          newDice,
        },
        warnings: [...previousWarnings, ...spendResult.warnings],
        ...outcomeMeta,
      },
    }
    setWillpowerRerollDraft(null)
    queueDiceOverlayRoll({
      id: `${updatedRoll.id}-reroll`,
      title: `${updatedRoll.characterName} · ${t('Переброс Воли')}`,
      groups: [{ key: 'main', label: '', dice: newDice.map(die => ({ value: die.value, kind: die.kind })) }],
    })
    await publishRollReplacement(updatedRoll)
  }

  const toggleMasterRollAttribute = (name: string) => {
    if (masterRollAttribute === name) {
      setMasterRollAttribute('')
      return
    }
    if (masterRollAttributeTwo === name) {
      setMasterRollAttributeTwo('')
      return
    }
    if (!masterRollAttribute) setMasterRollAttribute(name)
    else setMasterRollAttributeTwo(name)
  }

  const togglePreviewAttribute = (name: string) => {
    if (previewRollAttribute === name) {
      setPreviewRollAttribute('')
      return
    }
    if (previewRollAttributeTwo === name) {
      setPreviewRollAttributeTwo('')
      return
    }
    if (!previewRollAttribute) setPreviewRollAttribute(name)
    else setPreviewRollAttributeTwo(name)
  }

  const openPreviewDiscipline = (name: string) => {
    setPreviewDisciplineName(name)
    setPreviewPowerName('')
  }

  const clearPreviewHealth = () => {
    if (!previewCharacter) return
    if (window.confirm(t('Полностью очистить шкалу здоровья?'))) {
      void updateCharacterHealth(previewCharacter.id, tableHealth().normalizeHealthTracker({
        ...tableHealth().toHealthTracker(previewHealth),
        superficial: 0,
        aggravated: 0,
      }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), 'Здоровье очищено')
    }
  }

  const markPreviewTorporOrComa = () => {
    if (!previewCharacter) return
    const stateName = previewDamageProfile === 'vampire' ? 'торпор' : 'кому/смерть'
    if (window.confirm(tf('Отметить {state} и заполнить шкалу тяжёлыми повреждениями?', { state: t(stateName) }))) {
      void updateCharacterHealth(previewCharacter.id, tableHealth().normalizeHealthTracker({
        ...tableHealth().toHealthTracker(previewHealth),
        superficial: 0,
        aggravated: previewHealth.max,
      }, getCharacterHealthStamina(previewCharacter), previewDamageProfile), stateName)
    }
  }

  const confirmRecoverPreviewAggravatedWillpower = () => {
    if (!previewCharacter) return
    if (window.confirm(t('Снять один тяжёлый стресс Воли?'))) {
      void recoverWillpower(previewCharacter, 1, 'aggravated', 'Воля: восстановление тяжёлого стресса')
    }
  }

  const deactivatePreviewDisciplinePower = async () => {
    if (!previewCharacter || !selectedPreviewPower) return
    await runDeactivatePreviewDisciplinePower({
      previewCharacter,
      selectedPreviewPower,
      canRollPreview,
      selectedPreviewPowerIsActive,
      previewDisciplineName,
    })
  }

  const rollPreviewPower = async () => {
    if (!previewCharacter || !selectedPreviewPower) return
    await runRollPreviewPower({
      previewCharacter,
      selectedPreviewPower,
      canRollPreview,
      hasMissingPreviewPowerInput,
      previewDisciplineName,
      selectedPreviewPowerCostLabel,
      selectedPreviewPowerCost,
      previewPowerInputValues,
      previewPowerDiceCount,
      previewPowerPoolChoices,
      previewPowerPoolBeforeLimit,
      previewPowerPoolSelections,
      previewPowerModifier,
      previewPowerWillpowerImpairmentPenalty,
      previewPowerHealthImpairmentPenalty,
      disabledPreviewPowerModifierIds,
    })
  }

  const removePreviewActiveEffect = async (effectId: string) => {
    if (!previewCharacter || !chatUser) return
    await runRemovePreviewActiveEffect({
      previewCharacter,
      chatUser,
      canEditPreviewActiveEffects,
      effectId,
    })
  }

  const addExperienceToActiveCharacter = async () => {
    if (!chatUser || !previewCharacter?.id || previewCharacter.id !== selectedActiveCharacter?.id) return
    const amount = Number(window.prompt(t('Сколько опыта добавить?'), '1'))
    if (!Number.isFinite(amount) || amount <= 0) return
    const { row: data, error } = await fetchCharacterById(previewCharacter.id, {
      userId: chatUser.id,
      select: 'data',
    })
    if (error || !data?.data) {
      window.alert(t('Не удалось загрузить персонажа для добавления опыта.'))
      return
    }
    const characterData = data.data as Record<string, unknown>
    const current = Number(characterData.freeExp ?? characterData.experience ?? 0) || 0
    const nextData = {
      ...characterData,
      freeExp: current + amount,
      timestamp: new Date().toISOString(),
    }
    const { error: updateError } = await updateCharacterData(previewCharacter.id, nextData, {
      userId: chatUser.id,
    })
    if (updateError) {
      window.alert(t('Опыт не сохранился.'))
      return
    }
    const nextFreeExp = current + amount
    setPreviewCharacter(prev => prev ? { ...prev, freeExp: nextFreeExp } : prev)
    setChatCharacters(prev => prev.map(character => character.id === previewCharacter.id ? { ...character, freeExp: nextFreeExp } : character))
  }

  useEffect(() => {
    if (!chatUser || !journalStorageKey) {
      setJournalEntries([])
      setSelectedJournalEntryId('')
      return
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(journalStorageKey) || '[]') as JournalEntry[]
      const entries = Array.isArray(parsed) ? parsed : []
      setJournalEntries(entries)
      setSelectedJournalEntryId(entries[0]?.id || '')
      setJournalSaveStatus('Сохранено')
    } catch {
      setJournalEntries([])
      setSelectedJournalEntryId('')
    }
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser || journalSaveStatus !== 'Есть несохранённые изменения') return
    const timeout = window.setTimeout(() => persistCurrentJournal(), 800)
    return () => window.clearTimeout(timeout)
  }, [journalEntries, journalSaveStatus, chatUser])

  useEffect(() => {
    if (!chatUser || !journalStorageKey) return
    const interval = window.setInterval(() => {
      window.localStorage.setItem(journalStorageKey, JSON.stringify(journalEntriesRef.current))
      setJournalSaveStatus('Сохранено')
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [chatUser, journalStorageKey])

  useEffect(() => {
    if (!chatUser) return
    const character = selectedActiveCharacter
    const participant: ActiveParticipant = {
      userId: chatUser.id,
      username: chatUser.username,
      characterId: character?.id || null,
      characterName: character?.name || 'без персонажа',
      characterClan: character?.clan || null,
      characterImage: character?.image || '',
      updatedAt: new Date().toISOString(),
    }
    setRoomParticipants(prev => {
      const exists = prev.some(item => item.userId === participant.userId)
      return exists ? prev.map(item => item.userId === participant.userId ? participant : item) : [participant, ...prev]
    })
    broadcast('active-character', { room, participant })
  }, [chatUser, selectedChatCharacterId, chatCharacters, room])

  const activeScene = scenes.find(scene => scene.id === activeSceneId) || null
  const selectedScene = scenes.find(scene => scene.id === getSelectedSceneId()) || activeScene
  const activeSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === activeSceneId)), [sceneMusic, activeSceneId])
  const selectedSceneMusic = useMemo(() => sortSceneMusic(sceneMusic.filter(track => track.sceneId === selectedScene?.id)), [sceneMusic, selectedScene?.id])
  const isMusicPanelVisible = isMaster
    ? leftPanelOpen && leftToolbarTab === 'music'
    : rightPanelOpen && rightRailTab === 'media' && mediaTab === 'music'
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || null
  const previewLayer = layers.find(layer => layer.id === previewLayerId) || null
  const currentOwnerId = isMaster ? 'master' : chatUser?.id ?? null
  const currentSceneId = activeSceneId || scenes[0]?.id || null

  layerContextRef.current = {
    currentSceneId,
    currentOwnerId,
    selectedLayer,
    tableRole,
  }

  const visibleLayers = useMemo(
    () => sortLayers(layers).filter(layer => isLayerEffectivelyVisible(layer, layers)),
    [layers],
  )
  const checkLayerEffectivelyVisible = (layer: TableLayer) => isLayerEffectivelyVisible(layer, layers)
  const managerLayers = useMemo(
    () => (isMaster ? layers : layers.filter(layer => canEditLayer(layer))),
    [isMaster, layers, chatUser]
  )
  const tableManagerLayers = useMemo(() => managerLayers.filter(layer => layer.onTable), [managerLayers])
  const libraryLayers = useMemo(() => {
    const query = mediaSearchDraft.trim().toLowerCase()
    return managerLayers.filter(layer => !layer.onTable && (!query || layer.name.toLowerCase().includes(query) || layer.layerType.includes(query)))
  }, [managerLayers, mediaSearchDraft])
  const selectedManagerLayer = managerLayers.find(layer => layer.id === selectedLayerId) || null
  const layerTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(tableManagerLayers)
  }, [tableManagerLayers])
  const libraryTree = useMemo<LayerTreeNode[]>(() => {
    return buildLayerTree(libraryLayers)
  }, [libraryLayers])

  const sendMasterWhisper = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = masterChatDraft.trim()
    if (!chatUser || !text) return
    const targetId = isMaster ? selectedMasterChatUserId : null
    if (isMaster && !targetId) {
      window.alert(t('Выбери игрока для ответа.'))
      return
    }
    const message: MasterWhisper = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      room,
      fromUserId: chatUser.id,
      fromUsername: chatUser.username,
      toUserId: targetId,
      message: text,
      fromMaster: isMaster,
      createdAt: new Date().toISOString(),
    }
    setMasterChatDraft('')
    setMasterWhispers(prev => [...prev, message].slice(-160))
    broadcast('master-whisper', message)
  }

  const handleLogoutChat = () => {
    stopVoice()
    logoutChat()
  }

  const previewLayerOpacity = (id: string, opacity: number) => {
    const element = Array.from(sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]') || [])
      .find(item => item.dataset.layerId === id)
    if (element) element.style.opacity = String(opacity)
  }

  const commitLayerOpacity = (id: string, input: HTMLInputElement) => {
    const opacity = Number(input.value)
    if (!Number.isFinite(opacity) || input.dataset.committedValue === String(opacity)) return
    input.dataset.committedValue = String(opacity)
    void patchLayer(id, { opacity })
  }

  const uploadFiles = async (
    files: FileList | File[],
    onTable = true,
    options: { asBackground?: boolean; point?: { x: number; y: number }; preserveFolders?: boolean } = {}
  ) => {
    const uploadItems = Array.from(files).map(file => ({
      file,
      relativePath: options.preserveFolders ? file.webkitRelativePath || file.name : file.name,
    }))
    if (uploadItems.length === 0) return
    if (!isMaster && !chatUser) {
      window.alert(t('Сначала войди в аккаунт игрока, чтобы добавлять медиа в комнату.'))
      setRightRailTab('chat')
      return
    }

    setIsUploading(true)

    try {
      const folderIds = new Map<string, string | null>()

      const ensureFolder = async (folderPath: string, onTableForFolder: boolean) => {
        const parts = folderPath.split('/').map(part => part.trim()).filter(Boolean)
        if (parts.length === 0) return null

        let parentId: string | null = null
        let pathKey = ''

        for (const part of parts) {
          pathKey = pathKey ? `${pathKey}/${part}` : part
          if (folderIds.has(pathKey)) {
            parentId = folderIds.get(pathKey) ?? null
            continue
          }

          const existing = layersRef.current.find(layer =>
            layer.layerType === 'folder' &&
            layer.parentId === parentId &&
            layer.name === part &&
            layer.onTable === onTableForFolder
          )
          const folderId = existing?.id || await createFolder(parentId, part, false, onTableForFolder)
          folderIds.set(pathKey, folderId)
          if (folderId) parentId = folderId
        }

        return parentId
      }

      for (const [index, item] of uploadItems.entries()) {
        const file = item.file
        const relativeParts = item.relativePath.split('/').filter(Boolean)
        const parentFolderPath = relativeParts.length > 1 ? relativeParts.slice(0, -1).join('/') : ''
        const parentId = options.preserveFolders && parentFolderPath
          ? await ensureFolder(parentFolderPath, onTable)
          : undefined
        const layerType: 'image' | 'video' | 'text' | 'file' = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : isReadableTextFile(file)
              ? 'text'
              : 'file'
        const objectUrl = URL.createObjectURL(file)
        const natural = layerType === 'image' || layerType === 'video'
          ? await getMediaSize(objectUrl, layerType)
          : isWordLikeFile(file)
            ? { width: 460, height: 320 }
            : { width: 440, height: 300 }
        URL.revokeObjectURL(objectUrl)

        const storageFolderPath = options.preserveFolders
          ? relativeParts.slice(0, -1).map(part => safeStorageName(part)).filter(Boolean).join('/')
          : ''
        const { error: uploadError, publicUrl } = await uploadTableImageFile(room, file, { storageFolderPath })

        if (uploadError || !publicUrl) {
          console.error('Не удалось загрузить файл в Storage:', uploadError)
          window.alert(t('Файл не загрузился в Supabase Storage. Примени обновлённый SQL для bucket table-images.'))
          continue
        }

        const layerData = layerType === 'text'
          ? getTextLayerData(file, await getFileText(file))
          : layerType === 'file'
            ? JSON.stringify({
              url: publicUrl,
              type: file.type || 'application/octet-stream',
              wordLike: isWordLikeFile(file),
              pdf: /\.pdf$/i.test(file.name) || /pdf/i.test(file.type),
              name: file.name,
            })
            : publicUrl
        await addMediaLayer(
          layerData,
          options.asBackground ? `Фон — ${file.name}` : file.name,
          natural,
          layerType,
          index,
          options.asBackground ? { x: 0, y: 0 } : options.point,
          onTable,
          {
            ...(options.asBackground
              ? {
              zIndex: -1000 + index,
              locked: true,
              parentId: null,
              width: Math.max(1600, natural.width),
              height: Math.max(900, Math.round((Math.max(1600, natural.width) / Math.max(1, natural.width)) * Math.max(1, natural.height))),
              }
              : {}),
            ...(parentId !== undefined ? { parentId } : {}),
          }
        )
      }

      setTableStatus('Сцена онлайн')
    } finally {
      setIsUploading(false)
    }
  }

  const addRemoteMediaUrls = async (items: Array<{ url: string; layerType: 'image' | 'video' }>, point?: { x: number; y: number }, onTable = true) => {
    if (items.length === 0) return false
    setIsUploading(true)

    try {
      for (const [index, item] of items.entries()) {
        const natural = await getMediaSize(item.url, item.layerType)
        await addMediaLayer(
          item.url,
          getImageNameFromUrl(item.url),
          natural,
          item.layerType,
          index,
          point ? { x: point.x + index * 28, y: point.y + index * 24 } : undefined,
          onTable
        )
      }
      setTableStatus('Сцена онлайн')
      return true
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files, mediaTab !== 'library')
      event.target.value = ''
    }
  }

  const handleFolderUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files, mediaTab !== 'library', { preserveFolders: true })
      event.target.value = ''
    }
  }

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const imageFiles = Array.from(event.target.files).filter(file => file.type.startsWith('image/'))
      if (imageFiles.length === 0) window.alert(t('Для фона выбери картинку.'))
      else await uploadFiles(imageFiles, true, { asBackground: true })
      event.target.value = ''
    }
  }

  const handleMediaUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const items = getMediaUrlsFromText(mediaUrlDraft)
    if (items.length === 0) {
      window.alert(t('Вставь ссылку на YouTube или прямую ссылку на файл: jpg, png, webp, gif, svg, mp4, webm, mov, m4v, ogg.'))
      return
    }

    const added = await addRemoteMediaUrls(items)
    if (added) setMediaUrlDraft('')
  }

  const createTextMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = textMaterialDraft.trim()
    if (!text) return
    await addMediaLayer(
      text,
      textMaterialNameDraft.trim() || t('Текст мастера'),
      { width: 420, height: 260 },
      'text',
      0,
      undefined,
      false
    )
    setTextMaterialDraft('')
    setTextMaterialNameDraft('')
  }

  const openImageEditor = (layer: TableLayer) => {
    if (!canEditLayer(layer) || !['image', 'video'].includes(layer.layerType)) return
    setImageEditor({
      layerId: layer.id,
      state: createEditorState(layer),
      history: [],
      future: [],
      aspectLocked: false,
      drag: null,
    })
    setLayerContextMenu(null)
  }

  const updateImageEditor = (updater: (state: ImageEditorState) => ImageEditorState, commit = true) => {
    setImageEditor(editor => {
      if (!editor) return editor
      const nextState = updater(editor.state)
      return {
        ...editor,
        state: nextState,
        history: commit ? [...editor.history, editor.state].slice(-40) : editor.history,
        future: commit ? [] : editor.future,
      }
    })
  }

  const undoImageEditor = () => {
    setImageEditor(editor => {
      if (!editor || editor.history.length === 0) return editor
      const previous = editor.history[editor.history.length - 1]
      return {
        ...editor,
        state: previous,
        history: editor.history.slice(0, -1),
        future: [editor.state, ...editor.future].slice(0, 40),
      }
    })
  }

  const redoImageEditor = () => {
    setImageEditor(editor => {
      if (!editor || editor.future.length === 0) return editor
      const next = editor.future[0]
      return {
        ...editor,
        state: next,
        history: [...editor.history, editor.state].slice(-40),
        future: editor.future.slice(1),
      }
    })
  }

  const applyImageEditor = async (saveAsNew = false) => {
    if (!imageEditor) return
    const layer = layersRef.current.find(item => item.id === imageEditor.layerId)
    if (!layer) return
    const patch: LayerPatch = {
      cropX: imageEditor.state.cropX,
      cropY: imageEditor.state.cropY,
      cropWidth: imageEditor.state.cropWidth,
      cropHeight: imageEditor.state.cropHeight,
      rotation: imageEditor.state.rotation,
      flipX: imageEditor.state.flipX,
      flipY: imageEditor.state.flipY,
      brightness: imageEditor.state.brightness,
      contrast: imageEditor.state.contrast,
      saturation: imageEditor.state.saturation,
    }
    if (saveAsNew) {
      await addMediaLayer(layer.imageData, `${layer.name} copy`, { width: layer.width, height: layer.height }, layer.layerType === 'video' ? 'video' : 'image', 0, { x: layer.x + 32, y: layer.y + 32 }, layer.onTable, patch)
    } else {
      await patchLayer(layer.id, patch)
    }
    setImageEditor(null)
  }

  const getContextLayerIds = (layerId: string | null) => {
    if (layerId && selectedLayerIds.has(layerId) && selectedLayerIds.size > 1) return [...selectedLayerIds]
    if (layerId) return [layerId]
    return [...selectedLayerIds]
  }

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setTableStatus('Скопировано')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setTableStatus('Скопировано')
    }
  }

  const copyLayerForDiary = async (layer: TableLayer) => {
    await copyTextToClipboard(getLayerClipboardText(layer))
    setLayerContextMenu(null)
  }

  const addLayerToJournal = (imageUrl: string, name: string) => {
    if (!chatUser) return
    const imgHtml = `<p><img src="${imageUrl}" alt="${name}"></p>`
    if (selectedJournalEntry) {
      const newText = (selectedJournalEntry.text || '') + imgHtml
      const now = new Date().toISOString()
      const next = journalEntries.map(entry =>
        entry.id === selectedJournalEntry.id ? { ...entry, text: newText, updatedAt: now } : entry
      )
      saveJournalEntries(next, 'Есть несохранённые изменения')
    } else {
      const now = new Date().toISOString()
      const entry: JournalEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: name || t('Изображение со стола'),
        text: imgHtml,
        createdAt: now,
        updatedAt: now,
      }
      saveJournalEntries([entry, ...journalEntries], 'Сохранено')
      setSelectedJournalEntryId(entry.id)
    }
    setRightRailTab('diary')
    setLayerContextMenu(null)
    setTableStatus('Добавлено в дневник')
  }

  const copyLayerUrl = async (layer: TableLayer) => {
    const url = getLayerShareUrl(layer)
    await copyTextToClipboard(url || getLayerClipboardText(layer))
    setLayerContextMenu(null)
  }

  const focusLayersForEveryone = (ids: string[]) => {
    const targets = ids
      .map(id => layersRef.current.find(layer => layer.id === id))
      .filter((layer): layer is TableLayer => Boolean(layer))
    if (targets.length === 0 || !sceneRef.current) return

    const minX = Math.min(...targets.map(layer => layer.x))
    const minY = Math.min(...targets.map(layer => layer.y))
    const maxX = Math.max(...targets.map(layer => layer.x + layer.width))
    const maxY = Math.max(...targets.map(layer => layer.y + layer.height))
    const rect = sceneRef.current.getBoundingClientRect()
    const contentWidth = Math.max(1, maxX - minX)
    const contentHeight = Math.max(1, maxY - minY)
    const nextZoom = Math.min(5, Math.max(0.2, Math.min((rect.width - 80) / contentWidth, (rect.height - 80) / contentHeight)))
    const nextPan = {
      x: Math.round(rect.width / 2 - (minX + contentWidth / 2) * nextZoom),
      y: Math.round(rect.height / 2 - (minY + contentHeight / 2) * nextZoom),
    }

    setZoom(nextZoom)
    setPan(nextPan)
    broadcast('viewport-focus', { room, pan: nextPan, zoom: nextZoom })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const revealLayerInTableManager = (layer: TableLayer) => {
    if (!layer.onTable || !canEditLayer(layer)) return
    setRightRailTab('media')
    setMediaTab('layers')
    setExpandedFolders(prev => {
      const next = new Set(prev)
      getAncestorIds(layersRef.current, layer.id).forEach(id => next.add(id))
      return next
    })
    setLayerSelection([layer.id], layer.id)
  }

  const handleManagerDoubleClick = (layer: TableLayer) => {
    if (!layer.onTable && layer.layerType !== 'folder') {
      setPreviewLayerId(layer.id)
      return
    }
    if (layer.layerType === 'folder') {
      toggleFolder(layer.id)
      return
    }
    renameLayer(layer)
  }

  const canMoveLayer = (layer: TableLayer) => {
    if (layer.locked) return false
    return canEditLayer(layer)
  }

  const canDropLayerOn = (dragged: TableLayer, target: TableLayer, placement: LayerDropPlacement) => {
    if (!canMoveLayer(dragged)) return false
    if (dragged.id === target.id) return false
    if (placement === 'inside' && target.layerType !== 'folder') return false
    if (dragged.layerType === 'folder' && getDescendantIds(layersRef.current, dragged.id).has(target.id)) return false
    return true
  }

  const handleLayerDragStart = (event: React.DragEvent<HTMLElement>, layerId: string) => {
    const layer = layersRef.current.find(item => item.id === layerId)
    if (!layer || !canMoveLayer(layer)) {
      event.preventDefault()
      return
    }

    const shareUrl = getLayerShareUrl(layer)
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData('text/plain', layerId)
    if (shareUrl) {
      event.dataTransfer.setData('text/uri-list', shareUrl)
      event.dataTransfer.setData('application/x-vtm-layer', JSON.stringify({
        id: layer.id,
        title: layer.name,
        url: shareUrl,
        layerType: layer.layerType,
      }))
    }
    setDraggingLayerId(layerId)
    setLayerContextMenu(null)
  }

  const handleLayerDragOver = (event: React.DragEvent<HTMLElement>, target: TableLayer) => {
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === target.id) return
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged) return

    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const ratio = y / Math.max(1, rect.height)
    const placement: LayerDropPlacement =
      target.layerType === 'folder' && ratio > 0.28 && ratio < 0.72 ? 'inside' : ratio < 0.5 ? 'before' : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setLayerDropTarget({ layerId: target.id, placement })
  }

  const handleLayerDrop = async (event: React.DragEvent<HTMLElement>, target: TableLayer) => {
    event.preventDefault()
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || dragged.id === target.id) return

    const placement = layerDropTarget?.layerId === target.id ? layerDropTarget.placement : 'after'
    if (!canDropLayerOn(dragged, target, placement)) return
    const nextParentId = placement === 'inside' ? target.id : target.parentId
    const draggableLayers = layersRef.current.filter(layer => isMaster || canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === nextParentId && layer.id !== dragged.id)).reverse()
    const targetIndex = siblings.findIndex(layer => layer.id === target.id)
    const insertIndex = placement === 'inside' ? 0 : placement === 'before' ? Math.max(0, targetIndex) : Math.max(0, targetIndex + 1)
    siblings.splice(insertIndex, 0, { ...dragged, parentId: nextParentId })

    const highestZ = Math.max(1, ...layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? nextParentId : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    if (nextParentId) setExpandedFolders(prev => new Set(prev).add(nextParentId))
    setDraggingLayerId(null)
    setLayerDropTarget(null)
    await patchLayers(patches)
  }

  const handleLayerRootDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    if (event.currentTarget !== event.target) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setLayerDropTarget({ layerId: ROOT_LAYER_DROP_ID, placement: 'inside' })
  }

  const handleLayerRootDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target && layerDropTarget?.layerId !== ROOT_LAYER_DROP_ID) return
    event.preventDefault()
    const draggedId = draggingLayerId || event.dataTransfer.getData('text/plain')
    const dragged = layersRef.current.find(layer => layer.id === draggedId)
    if (!dragged || !canMoveLayer(dragged)) return

    const draggableLayers = layersRef.current.filter(layer => isMaster || canEditLayer(layer))
    const siblings = sortLayers(draggableLayers.filter(layer => layer.parentId === null && layer.id !== dragged.id)).reverse()
    siblings.push({ ...dragged, parentId: null })

    const highestZ = Math.max(1, ...layersRef.current.map(layer => layer.zIndex)) + siblings.length
    const patches = siblings.map((layer, index) => ({
      id: layer.id,
      patch: {
        parentId: layer.id === dragged.id ? null : layer.parentId,
        zIndex: highestZ - index,
      },
    }))

    setDraggingLayerId(null)
    setLayerDropTarget(null)
    await patchLayers(patches)
  }

  const handleLayerDragEnd = () => {
    setDraggingLayerId(null)
    setLayerDropTarget(null)
  }

  const getScenePointFromClient = (clientX: number, clientY: number) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoom,
      y: (clientY - rect.top - panRef.current.y) / zoom,
    }
  }

  const getScenePoint = (event: React.PointerEvent<HTMLElement>) => getScenePointFromClient(event.clientX, event.clientY)

  const prepareLayerDragPreview = (ids: Set<string>, mode: 'move' | 'resize') => {
    const elements = new Map<string, HTMLElement>()
    sceneRef.current?.querySelectorAll<HTMLElement>('.scene-layer[data-layer-id]').forEach(element => {
      const id = element.dataset.layerId
      if (!id || !ids.has(id)) return
      element.style.willChange = mode === 'move' ? 'transform' : 'left, top, width, height'
      elements.set(id, element)
    })
    dragLayerElementsRef.current = elements
    dragPreviewPositionsRef.current = new Map()
    dragPreviewBoundsRef.current = null
    pendingDragPointerRef.current = null
  }

  const applyLayerMovePreview = (drag: DragState, clientX: number, clientY: number) => {
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const positions = new Map<string, { x: number; y: number }>()
    positions.set(drag.id, {
      x: Math.round(drag.startX + sceneDx),
      y: Math.round(drag.startY + sceneDy),
    })
    drag.childStartPositions.forEach(child => {
      positions.set(child.id, {
        x: Math.round(child.x + sceneDx),
        y: Math.round(child.y + sceneDy),
      })
    })
    dragPreviewPositionsRef.current = positions

    dragLayerElementsRef.current.forEach(element => {
      element.style.transform = `translate3d(${sceneDx}px, ${sceneDy}px, 0)`
    })
  }

  const applyLayerResizePreview = (drag: DragState, clientX: number, clientY: number) => {
    const sceneDx = (clientX - drag.startClientX) / zoom
    const sceneDy = (clientY - drag.startClientY) / zoom
    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.startWidth + horizontal
    const widthFromY = (drag.startHeight + vertical) * drag.aspectRatio
    const width = Math.max(60, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const height = Math.max(60, Math.round(width / drag.aspectRatio))
    const x = drag.corner?.includes('w') ? Math.round(drag.startX + drag.startWidth - width) : drag.startX
    const y = drag.corner?.includes('n') ? Math.round(drag.startY + drag.startHeight - height) : drag.startY
    dragPreviewBoundsRef.current = { x, y, width, height }

    const element = dragLayerElementsRef.current.get(drag.id)
    if (!element) return
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  const startLayerDrag = (event: React.PointerEvent<HTMLElement>, layer: TableLayer, mode: 'move' | 'resize', corner: DragState['corner'] = 'se') => {
    if (event.button !== 0) return
    if (!canEditLayer(layer)) return
    if (layer.locked) return
    const target = event.target as HTMLElement
    if (layer.layerType === 'text' && target.closest('.scene-text-material')) {
      setLayerSelection([layer.id], layer.id)
      return
    }
    if (mode === 'move' && layer.layerType === 'video' && target instanceof HTMLVideoElement) {
      const rect = target.getBoundingClientRect()
      const controlHeight = Math.min(56, Math.max(36, rect.height * 0.3))
      if (event.clientY >= rect.bottom - controlHeight) {
        setLayerSelection([layer.id], layer.id)
        return
      }
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextSelection = selectedLayerIds.has(layer.id) ? selectedLayerIds : new Set([layer.id])
    setSelectedLayerIds(nextSelection)
    setSelectedLayerId(layer.id)
    const moveIds = new Set<string>()
    if (mode === 'move') {
      nextSelection.forEach(id => {
        moveIds.add(id)
        getDescendantIds(layersRef.current, id).forEach(childId => moveIds.add(childId))
      })
      moveIds.delete(layer.id)
    }
    dragRef.current = {
      id: layer.id,
      mode,
      corner,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      startHeight: layer.height,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      aspectRatio: Math.max(0.01, layer.width / layer.height),
      childStartPositions: layersRef.current
        .filter(item => moveIds.has(item.id))
        .map(item => ({ id: item.id, x: item.x, y: item.y })),
    }
    prepareLayerDragPreview(new Set([layer.id, ...moveIds]), mode)
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 2 && event.button !== 0) return
    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (event.button === 0 && !emptySceneTarget) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    suppressNextContextMenuRef.current = false
    if (event.button === 0) {
      const point = getScenePoint(event)
      setLayerSelection([])
      setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      dragRef.current = {
        id: '',
        mode: 'select',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        startY: point.y,
        startWidth: 0,
        startHeight: 0,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        aspectRatio: 1,
        childStartPositions: [],
      }
      return
    }
    dragRef.current = {
      id: '',
      mode: 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      aspectRatio: 1,
      childStartPositions: [],
    }
  }

  const updateLayerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return

    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY

    if (drag.mode === 'pan') {
      if (Math.abs(dx) + Math.abs(dy) > 6) suppressNextContextMenuRef.current = true
      setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
      return
    }

    if (drag.mode === 'select') {
      const point = getScenePoint(event)
      const x = Math.min(drag.startX, point.x)
      const y = Math.min(drag.startY, point.y)
      const width = Math.abs(point.x - drag.startX)
      const height = Math.abs(point.y - drag.startY)
      const rect = { x, y, width, height }
      setSelectionRect(rect)
      const selected = visibleLayers
        .filter(layer => (
          layer.x < x + width &&
          layer.x + layer.width > x &&
          layer.y < y + height &&
          layer.y + layer.height > y
        ))
        .map(layer => layer.id)
      setLayerSelection(selected)
      return
    }

    if (drag.mode === 'move' || drag.mode === 'resize') {
      pendingDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY }
      if (dragAnimationFrameRef.current === null) {
        dragAnimationFrameRef.current = requestAnimationFrame(() => {
          dragAnimationFrameRef.current = null
          const pending = pendingDragPointerRef.current
          const activeDrag = dragRef.current
          if (!pending || !activeDrag) return
          if (activeDrag.mode === 'move') applyLayerMovePreview(activeDrag, pending.clientX, pending.clientY)
          if (activeDrag.mode === 'resize') applyLayerResizePreview(activeDrag, pending.clientX, pending.clientY)
        })
      }
      return
    }
  }

  const finishLayerDrag = async () => {
    const drag = dragRef.current
    if (!drag) return

    if ((drag.mode === 'move' || drag.mode === 'resize') && pendingDragPointerRef.current) {
      if (dragAnimationFrameRef.current !== null) cancelAnimationFrame(dragAnimationFrameRef.current)
      dragAnimationFrameRef.current = null
      if (drag.mode === 'move') applyLayerMovePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
      if (drag.mode === 'resize') applyLayerResizePreview(drag, pendingDragPointerRef.current.clientX, pendingDragPointerRef.current.clientY)
    }
    dragRef.current = null
    pendingDragPointerRef.current = null
    if (drag.mode === 'select') {
      setSelectionRect(null)
      return
    }
    if (drag.mode === 'pan') return
    if (drag.mode === 'move') {
      const positions = dragPreviewPositionsRef.current
      dragPreviewPositionsRef.current = new Map()
      if (positions.size === 0) {
        dragLayerElementsRef.current.forEach(element => {
          element.style.transform = ''
          element.style.willChange = ''
        })
        dragLayerElementsRef.current = new Map()
        return
      }

      const nextLayers = layersRef.current.map(layer => {
        const position = positions.get(layer.id)
        return position ? { ...layer, ...position } : layer
      })
      layersRef.current = nextLayers
      dragLayerElementsRef.current.forEach((element, id) => {
        const position = positions.get(id)
        if (position) {
          element.style.left = `${position.x}px`
          element.style.top = `${position.y}px`
        }
        element.style.transform = ''
        element.style.willChange = ''
      })
      dragLayerElementsRef.current = new Map()
      setLayers(nextLayers)

      const updates = Array.from(positions, ([id, position]) => ({ id, ...position }))
      broadcast('layer-move', { room, updates })
      const results = await updateLayerRecords(
        updates.map(update => ({ id: update.id, patch: { x: update.x, y: update.y } })),
      )
      if (results.some(result => result.error)) {
        console.error('Не удалось сохранить перемещение слоёв:', results.filter(result => result.error).map(result => result.error))
        setTableStatus('Позиция слоя не сохранилась')
      }
      return
    }
    const bounds = dragPreviewBoundsRef.current
    dragPreviewBoundsRef.current = null
    dragLayerElementsRef.current.forEach(element => {
      element.style.willChange = ''
    })
    dragLayerElementsRef.current = new Map()
    if (bounds) await patchLayer(drag.id, bounds)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const nextZoom = Math.min(5, Math.max(0.2, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom
    setPan({
      x: Math.round(cursorX - worldX * nextZoom),
      y: Math.round(cursorY - worldY * nextZoom),
    })
    setZoom(nextZoom)
  }

  const getTouchCenter = (touches: React.TouchList | TouchList) => {
    const first = touches[0]
    const second = touches[1] || touches[0]
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    }
  }

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return 1
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.max(1, Math.hypot(dx, dy))
  }

  const startSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return

    if (event.touches.length >= 2) {
      event.preventDefault()
      dragRef.current = null
      setSelectionRect(null)
      const center = getTouchCenter(event.touches)
      touchGestureRef.current = {
        mode: 'pinch',
        startClientX: center.x,
        startClientY: center.y,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        startDistance: getTouchDistance(event.touches),
        startZoom: zoom,
        worldCenterX: (center.x - rect.left - panRef.current.x) / zoom,
        worldCenterY: (center.y - rect.top - panRef.current.y) / zoom,
      }
      return
    }

    const target = event.target as HTMLElement
    const emptySceneTarget = target.classList.contains('scene') || target.classList.contains('scene-world')
    if (!emptySceneTarget) return

    event.preventDefault()
    const touch = event.touches[0]
    touchGestureRef.current = {
      mode: 'pan',
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
      startDistance: 1,
      startZoom: zoom,
      worldCenterX: 0,
      worldCenterY: 0,
    }
  }

  const updateSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!gesture || !rect) return

    event.preventDefault()
    if (gesture.mode === 'pinch' && event.touches.length >= 2) {
      const center = getTouchCenter(event.touches)
      const nextZoom = Math.min(5, Math.max(0.2, gesture.startZoom * (getTouchDistance(event.touches) / gesture.startDistance)))
      setZoom(nextZoom)
      setPan({
        x: Math.round(center.x - rect.left - gesture.worldCenterX * nextZoom),
        y: Math.round(center.y - rect.top - gesture.worldCenterY * nextZoom),
      })
      return
    }

    if (gesture.mode === 'pan' && event.touches.length === 1) {
      const touch = event.touches[0]
      setPan({
        x: Math.round(gesture.startPanX + touch.clientX - gesture.startClientX),
        y: Math.round(gesture.startPanY + touch.clientY - gesture.startClientY),
      })
    }
  }

  const finishSceneTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) touchGestureRef.current = null
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const libraryLayerId = event.dataTransfer.getData('application/x-vtm-library-layer')
    if (libraryLayerId) {
      await placeLayerOnTable(libraryLayerId, getScenePointFromClient(event.clientX, event.clientY))
      return
    }
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.some(file => file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY), preserveFolders: true })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) {
      await addRemoteMediaUrls(mediaUrls, getScenePointFromClient(event.clientX, event.clientY))
      return
    }

    if (droppedFiles.length > 0) await uploadFiles(droppedFiles, true, { point: getScenePointFromClient(event.clientX, event.clientY), preserveFolders: true })
  }

  const handleSceneMediaDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, false, { preserveFolders: true })
      return
    }

    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, false)
  }

  const handleSceneMusicDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) await uploadSceneMusicFiles(droppedFiles)
  }

  const handleTableLayerPanelDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, true, { preserveFolders: true })
      return
    }
    const mediaUrls = getDroppedMediaUrls(event.dataTransfer)
    if (mediaUrls.length > 0) await addRemoteMediaUrls(mediaUrls, undefined, true)
  }

  const startEditorCropDrag = (event: React.PointerEvent<HTMLElement>, handle: NonNullable<ImageEditorDraft['drag']>['handle']) => {
    if (!imageEditor) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setImageEditor({
      ...imageEditor,
      history: [...imageEditor.history, imageEditor.state].slice(-40),
      future: [],
      drag: {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        initial: imageEditor.state,
      },
    })
  }

  const updateEditorCropDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!imageEditor?.drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = ((event.clientX - imageEditor.drag.startX) / Math.max(1, rect.width)) * 100
    const dy = ((event.clientY - imageEditor.drag.startY) / Math.max(1, rect.height)) * 100
    const initial = imageEditor.drag.initial
    let cropX = initial.cropX
    let cropY = initial.cropY
    let cropWidth = initial.cropWidth
    let cropHeight = initial.cropHeight

    if (imageEditor.drag.handle === 'move') {
      cropX = initial.cropX + dx
      cropY = initial.cropY + dy
    } else {
      if (imageEditor.drag.handle.includes('w')) {
        cropX = initial.cropX + dx
        cropWidth = initial.cropWidth - dx
      }
      if (imageEditor.drag.handle.includes('e')) cropWidth = initial.cropWidth + dx
      if (imageEditor.drag.handle.includes('n')) {
        cropY = initial.cropY + dy
        cropHeight = initial.cropHeight - dy
      }
      if (imageEditor.drag.handle.includes('s')) cropHeight = initial.cropHeight + dy
    }

    cropWidth = Math.max(8, Math.min(100, cropWidth))
    cropHeight = Math.max(8, Math.min(100, cropHeight))
    cropX = Math.max(0, Math.min(100 - cropWidth, cropX))
    cropY = Math.max(0, Math.min(100 - cropHeight, cropY))
    setImageEditor({ ...imageEditor, state: { ...imageEditor.state, cropX, cropY, cropWidth, cropHeight } })
  }

  const finishEditorCropDrag = () => {
    setImageEditor(editor => (editor ? { ...editor, drag: null } : editor))
  }

  const getCharacterSheetHref = (characterId?: string | null) => {
    const params = new URLSearchParams({ room })
    if (tableRole) params.set('role', tableRole)
    if (characterId) params.set('characterId', characterId)
    return `/character-sheet?${params.toString()}`
  }

  const renderRollMeta = (roll: RollMessage) => {
    const meta = roll.meta
    if (!meta) return null
    const rouseChecks = meta.rouseChecks || []
    const warnings = meta.warnings || []
    const rollModifiers = meta.rollModifiers || []
    const hungerChange = typeof meta.hungerBefore === 'number'
      && typeof meta.hungerAfter === 'number'
      && meta.hungerBefore !== meta.hungerAfter
      ? { before: meta.hungerBefore, after: meta.hungerAfter }
      : null
    const hasHungerChange = hungerChange !== null
    const hasWillpowerChange = Boolean(meta.willpowerBefore && meta.willpowerAfter && meta.willpowerBefore.current !== meta.willpowerAfter.current)
    const hasWillpowerMeta = hasWillpowerChange
      || Boolean(meta.spentWillpower)
      || Boolean(meta.recoveredWillpower)
      || Boolean(meta.willpowerReroll?.used)
      || Boolean(meta.impairmentPenaltyApplied)
    const hasHealthChange = Boolean(meta.healthBefore && meta.healthAfter)
    const hasHealthMeta = hasHealthChange
      || Boolean(meta.damage)
      || Boolean(meta.healing)
      || Boolean(meta.healthImpairmentPenaltyApplied)
    const hasHumanityMeta = meta.rollKind === 'humanity_check'
      || meta.rollKind === 'remorse_check'
      || typeof meta.humanityBefore === 'number'
      || typeof meta.stainsBefore === 'number'

    if (!rouseChecks.length && !meta.bloodSurge?.enabled && !hasHungerChange && !hasWillpowerMeta && !hasHealthMeta && !hasHumanityMeta && !meta.messyCritical && !meta.bestialFailure && !warnings.length && !meta.discipline && !rollModifiers.length && !meta.rollDifficultyModifier) {
      return null
    }

    return (
      <div className="roll-v5-meta">
        {meta.discipline ? (
          <span className="roll-note">{tf('Дисциплина: {name} · {power}', { name: meta.discipline.name, power: meta.discipline.power })}{meta.discipline.cost && meta.discipline.cost !== '—' ? ` · ${t(meta.discipline.cost)}` : ''}</span>
        ) : null}
        {meta.bloodSurge?.enabled ? (
          <span className="roll-note">{tf('Прилив Крови: +{bonus}к10', { bonus: meta.bloodSurge.bonusDice })}</span>
        ) : null}
        {rouseChecks.map(result => (
          <span className="roll-note" key={result.id}>
            {tf('{reason}: {value} · {outcome}', { reason: t(result.reason), value: result.value, outcome: result.success ? t('успех') : t('провал') })}
          </span>
        ))}
        {hungerChange ? <span className="roll-note">{tf('Голод: {before} → {after}', hungerChange)}</span> : null}
        {meta.spentWillpower ? <span className="roll-note">{tf('Воля потрачена: {n}', { n: meta.spentWillpower })}</span> : null}
        {meta.recoveredWillpower ? <span className="roll-note">{tf('Воля восстановлена: {n}', { n: meta.recoveredWillpower })}</span> : null}
        {hasWillpowerChange && meta.willpowerBefore && meta.willpowerAfter ? (
          <span className="roll-note">{tf('Воля: {before} → {after} / {max}', { before: meta.willpowerBefore.current, after: meta.willpowerAfter.current, max: meta.willpowerAfter.max })}</span>
        ) : null}
        {meta.willpowerReroll?.used ? (
          <span className="roll-note">{tf('Переброс Воли: {before} → {after}', { before: meta.willpowerReroll.oldDice.map(die => die.value).join(', '), after: meta.willpowerReroll.newDice.map(die => die.value).join(', ') })}</span>
        ) : null}
        {meta.impairmentPenaltyApplied ? <span className="roll-note">{tf('Истощение Воли: {n}к10', { n: meta.impairmentPenaltyApplied })}</span> : null}
        {meta.healthImpairmentPenaltyApplied ? <span className="roll-note">{tf('Изнурение по здоровью: {n}к10', { n: meta.healthImpairmentPenaltyApplied })}</span> : null}
        {rollModifiers.length ? (
          <span className="roll-note">
            {t('Модификаторы')}: {rollModifiers.map(modifier => summarizeRollModifier(modifier, tf, d10)).join(' · ')}
          </span>
        ) : null}
        {meta.damage ? (
          <span className="roll-note">
            {tf('Урон: {amount} {severity}', { amount: meta.damage.originalAmount, severity: meta.damage.severity === 'aggravated' ? t('тяжёлых') : t('лёгких') })}
            {meta.damage.halved ? tf(' → после деления {final}', { final: meta.damage.finalAmount }) : ''}
            {meta.damage.targetCharacterName ? tf(' · цель: {name}', { name: meta.damage.targetCharacterName }) : ''}
          </span>
        ) : null}
        {meta.damage?.chain?.map((line, index) => (
          <span className="roll-note" key={`${roll.id}-damage-chain-${index}`}>
            {line}
          </span>
        ))}
        {meta.healthBefore && meta.healthAfter ? (
          <span className="roll-note">
            {tf('Здоровье: {before} → {after} / {max} · / {superficial} · X {aggravated}', {
              before: meta.healthBefore.current, after: meta.healthAfter.current, max: meta.healthAfter.max,
              superficial: meta.healthAfter.superficial, aggravated: meta.healthAfter.aggravated
            })}
          </span>
        ) : null}
        {meta.healing ? (
          <span className="roll-note">
            {tf('Лечение: / {superficial} · X {aggravated}', { superficial: meta.healing.amountSuperficial || 0, aggravated: meta.healing.amountAggravated || 0 })}
          </span>
        ) : null}
        {meta.rollKind === 'remorse_check' ? (
          <span className="roll-note">
            {tf('Проверка мук совести: {result}', { result: meta.automaticFailure ? t('автоматический провал') : tf('{dice}к10 без кубиков Голода', { dice: meta.remorseDice || 0 }) })}
          </span>
        ) : null}
        {typeof meta.humanityBefore === 'number' && typeof meta.humanityAfter === 'number' ? (
          <span className="roll-note">{tf('Человечность: {before} → {after}', { before: meta.humanityBefore, after: meta.humanityAfter })}</span>
        ) : null}
        {typeof meta.stainsBefore === 'number' && typeof meta.stainsAfter === 'number' ? (
          <span className="roll-note">{tf('Сомнения: {before} → {after}', { before: meta.stainsBefore, after: meta.stainsAfter })}</span>
        ) : null}
        {meta.messyCritical ? <strong className="roll-alert">{t('Кровавый триумф')}</strong> : null}
        {meta.bestialFailure ? <strong className="roll-alert">{t('Кровавый провал')}</strong> : null}
        {warnings.map((warning, index) => <span className="roll-warning" key={`${roll.id}-warning-${index}`}>{t(warning)}</span>)}
      </div>
    )
  }

  const opposedResponsePool = getOpposedCharacterPool(selectedActiveCharacter, opposedResponseSide)
  const canAnswerOpposedProposal = Boolean(incomingOpposedProposal && selectedActiveCharacter && opposedResponsePool.diceCount > 0)

  return (
    <main className="table-page-shell">
      <section className="table-topbar">
        <div>
          <p className="table-kicker">{t('Игровой стол')}</p>
          <h1>{room}</h1>
        </div>
        <div className="table-actions">
          <a href="/" title={t('Вернуться на главную страницу')}>{t('Главная')}</a>
          <MasterRoleTopbar
            tableRole={tableRole}
            isMaster={isMaster}
            masterPasswordEdit={masterPasswordEdit}
            onMasterPasswordEditChange={setMasterPasswordEdit}
            onResetTableRole={resetTableRole}
            onSaveMasterPassword={saveMasterPassword}
          />
          <a href={getCharacterSheetHref(selectedActiveCharacter?.id)} title={t('Открыть лист персонажа')}>{t('Лист')}</a>
          <input ref={fileInputRef} type="file" multiple onChange={handleImageUpload} />
          <input ref={folderInputRef} type="file" multiple onChange={handleFolderUpload} />
          <input ref={backgroundFileInputRef} type="file" accept="image/*" multiple onChange={handleBackgroundUpload} />
          <input ref={sceneMusicFileInputRef} type="file" accept="audio/*" multiple onChange={handleSceneMusicUpload} />
        </div>
      </section>

      {!isMaster ? <section className="active-character-strip" aria-label={t('Активный персонаж')}>
        <div className="active-character-card">
          <div className="chat-avatar large" aria-hidden="true">
            {selectedActiveCharacter?.image ? (
              <img src={selectedActiveCharacter.image} alt="" />
            ) : (
              <span>{(selectedActiveCharacter?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <span>{t('Активный персонаж')}</span>
            <strong>{selectedActiveCharacter?.name || t('Персонаж не выбран')}</strong>
            <small>{selectedActiveCharacter?.clan || (chatUser ? t('без клана') : t('войдите в аккаунт'))}</small>
          </div>
          <button type="button" onClick={() => selectedActiveCharacter ? void openCharacterPreview(selectedActiveCharacter) : setRightRailTab('chat')} disabled={!selectedActiveCharacter}>
            {t('Быстрый просмотр')}
          </button>
          <a href={getCharacterSheetHref(selectedActiveCharacter?.id)}>{t('Открыть полный лист')}</a>
        </div>
        <div className="active-character-picker">
          <label>
            <span>{t('Смена персонажа')}</span>
            <select
              value={selectedChatCharacterId}
              onChange={event => chooseActiveCharacter(event.target.value)}
              disabled={!chatUser || chatCharacters.length === 0}
            >
              {chatCharacters.length === 0 ? <option value="">{t('Нет сохранённых персонажей')}</option> : null}
              {chatCharacters.map(character => (
                <option value={character.id} key={character.id}>
                  {character.name}{character.clan ? `, ${character.clan}` : ''}
                </option>
              ))}
            </select>
          </label>
          {!selectedActiveCharacter ? <button type="button" onClick={() => setRightRailTab('chat')}>{t('Выбрать персонажа')}</button> : null}
        </div>
      </section> : null}

      <MusicPlayer
        room={room}
        tableRole={tableRole}
        channelRef={channelRef}
        hidden
        playbackEnabled
      />

      <section className={`table-layout ${isMaster && leftPanelOpen ? 'with-left-toolbar' : ''} ${isMaster && !leftPanelOpen ? 'left-collapsed' : ''} ${!rightPanelOpen ? 'right-collapsed' : ''}`}>
        <TableLeftPanel
          isMaster={isMaster}
          leftPanelOpen={leftPanelOpen}
          setLeftPanelOpen={setLeftPanelOpen}
        >
        {isMaster && leftPanelOpen ? (
          <aside className="left-toolbar" aria-label={t('Мастерская панель сцен')}>
            <nav className="left-tabs" aria-label={t('Разделы сцен')}>
              <button type="button" className={leftToolbarTab === 'scenes' ? 'active' : ''} onClick={() => setLeftToolbarTab('scenes')}>{t('Сцены')}</button>
              <button type="button" className={leftToolbarTab === 'layers' ? 'active' : ''} onClick={() => setLeftToolbarTab('layers')}>{t('Слои')}</button>
              <button type="button" className={leftToolbarTab === 'media' ? 'active' : ''} onClick={() => setLeftToolbarTab('media')}>{t('Медиа')}</button>
              <button type="button" className={leftToolbarTab === 'music' ? 'active' : ''} onClick={() => setLeftToolbarTab('music')}>{t('Музыка')}</button>
            </nav>

            <SceneManager
              leftToolbarTab={leftToolbarTab}
              activeScene={activeScene}
              selectedScene={selectedScene}
              sceneStatus={sceneStatus}
              scenes={scenes}
              selectedSceneMusic={selectedSceneMusic}
              room={room}
              sceneMusicDraft={sceneMusicDraft}
              isUploading={isUploading}
              sceneMusicFileInputRef={sceneMusicFileInputRef}
              createScene={createScene}
              renameScene={renameScene}
              deleteScene={deleteScene}
              activateScene={activateScene}
              loadSceneMusic={loadSceneMusic}
              setSelectedSceneId={setSelectedSceneId}
              handleSceneMusicDrop={handleSceneMusicDrop}
              addSceneMusic={addSceneMusic}
              setSceneMusicDraft={setSceneMusicDraft}
              reorderSceneMusic={reorderSceneMusic}
              publishSceneTrack={publishSceneTrack}
              patchSceneMusic={patchSceneMusic}
              renameSceneMusic={renameSceneMusic}
              deleteSceneMusic={deleteSceneMusic}
            />

            <section className={`scene-layer-panel ${leftToolbarTab === 'layers' ? '' : 'table-right-panel-hidden'}`}>
              <header>
                <strong>{t('Слои сцены')}</strong>
                <span>{activeScene?.name || t('активная сцена')}</span>
              </header>
              <div className="scene-layer-groups">
                {/* 'фон'/'токен' below match layer.name, a Storyteller-assigned scene-layer
                    label (data, not UI copy) — not part of the RU/EN site translation. */}
                {[
                  ['Фон', tableManagerLayers.filter(layer => layer.onTable && (layer.zIndex < 0 || layer.name.toLowerCase().includes('фон')))],
                  ['Картинки / декорации', tableManagerLayers.filter(layer => layer.onTable && ['image', 'video'].includes(layer.layerType) && layer.zIndex >= 0 && !layer.name.toLowerCase().includes('фон'))],
                  ['Токены', tableManagerLayers.filter(layer => layer.onTable && layer.name.toLowerCase().includes('токен'))],
                  ['Группы / папки', tableManagerLayers.filter(layer => layer.onTable && layer.layerType === 'folder')],
                  ['Текст / документы', tableManagerLayers.filter(layer => layer.onTable && ['text', 'file'].includes(layer.layerType))],
                ].map(([title, items]) => (
                  <details open key={title as string}>
                    <summary>{t(title as string)}<span>{(items as TableLayer[]).length}</span></summary>
                    <div
                      className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                      onDragOver={handleLayerRootDragOver}
                      onDrop={handleLayerRootDrop}
                    >
                      {(items as TableLayer[]).length === 0 ? <p className="panel-empty">{t('Пусто')}</p> : <LayerManager layers={buildLayerTree(items as TableLayer[])}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section
              className={`scene-media-panel ${leftToolbarTab === 'media' ? '' : 'table-right-panel-hidden'}`}
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleSceneMediaDrop}
            >
              <header>
                <strong>{t('Медиа сцены')}</strong>
                <span>{selectedScene?.name || activeScene?.name || t('сцена')}</span>
              </header>
              <div className="media-manager-toolbar">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? t('Загрузка...') : t('Загрузить')}
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
                  {t('Папка файлов')}
                </button>
                <button type="button" onClick={() => backgroundFileInputRef.current?.click()} disabled={isUploading}>
                  {t('Фон')}
                </button>
                <button type="button" onClick={() => createNamedFolder(null, false)}>{t('Папка')}</button>
                <button type="button" onClick={saveSelectionAsGroup} disabled={selectedLayerIds.size === 0}>{t('Группа')}</button>
                <button type="button" onClick={setSceneThumbnailFromSelection} disabled={selectedLayerIds.size === 0}>Preview</button>
              </div>
              <form className="media-url-form" onSubmit={event => {
                event.preventDefault()
                const items = getMediaUrlsFromText(mediaUrlDraft)
                void addRemoteMediaUrls(items, undefined, false).then(added => {
                  if (added) setMediaUrlDraft('')
                })
              }}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder={t('Ссылка на картинку, видео или YouTube')}
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>{t('В папку')}</button>
              </form>
              <input
                className="media-search-input"
                data-media-search
                value={mediaSearchDraft}
                onChange={event => setMediaSearchDraft(event.target.value)}
                placeholder={t('Поиск медиа')}
              />
              <div
                className="layer-list library-list scene-media-drop-zone"
                onDragOver={event => {
                  event.preventDefault()
                  if (!event.dataTransfer.types.includes('Files')) handleLayerRootDragOver(event as React.DragEvent<HTMLDivElement>)
                }}
                onDrop={async event => {
                  if (event.dataTransfer.files.length > 0 || getDroppedMediaUrls(event.dataTransfer).length > 0) {
                    await handleSceneMediaDrop(event)
                    return
                  }
                  await handleLayerRootDrop(event as React.DragEvent<HTMLDivElement>)
                }}
              >
                {libraryTree.length === 0 ? <p className="panel-empty">{t('Подготовленные медиа этой сцены появятся здесь.')}</p> : <LayerManager layers={libraryTree}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />}
              </div>
            </section>

            {leftToolbarTab === 'music' ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <MusicPlayer room={room} tableRole={tableRole} channelRef={channelRef} playbackEnabled={false} />
              </div>
            ) : null}
          </aside>
        ) : null}
        </TableLeftPanel>

        <TableCanvas
          tableStatus={tableStatus}
          activeScene={activeScene}
          layersLength={layers.length}
          zoom={zoom}
          pan={pan}
          handNotice={handNotice}
          isDraggingOver={isDraggingOver}
          visibleLayers={visibleLayers}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          imageEditor={imageEditor}
          selectionRect={selectionRect}
          sceneRef={sceneRef}
          suppressNextContextMenuRef={suppressNextContextMenuRef}
          canEditLayer={canEditLayer}
          raiseHand={raiseHand}
          setZoom={setZoom}
          setIsDraggingOver={setIsDraggingOver}
          setLayerContextMenu={setLayerContextMenu}
          setLayerSelection={setLayerSelection}
          setSelectedLayerId={setSelectedLayerId}
          setImageEditor={setImageEditor}
          startPan={startPan}
          updateLayerDrag={updateLayerDrag}
          finishLayerDrag={finishLayerDrag}
          startSceneTouch={startSceneTouch}
          updateSceneTouch={updateSceneTouch}
          finishSceneTouch={finishSceneTouch}
          handleWheel={handleWheel}
          handleDrop={handleDrop}
          startLayerDrag={startLayerDrag}
          openImageEditor={openImageEditor}
          revealLayerInTableManager={revealLayerInTableManager}
          updateEditorCropDrag={updateEditorCropDrag}
          finishEditorCropDrag={finishEditorCropDrag}
          startEditorCropDrag={startEditorCropDrag}
          applyImageEditor={applyImageEditor}
          updateImageEditor={updateImageEditor}
          undoImageEditor={undoImageEditor}
          redoImageEditor={redoImageEditor}
          previewLayerOpacity={previewLayerOpacity}
          commitLayerOpacity={commitLayerOpacity}
        />

        <TableRightPanel
          isMaster={isMaster}
          rightPanelOpen={rightPanelOpen}
          rightRailTab={rightRailTab}
          setRightPanelOpen={setRightPanelOpen}
          setRightRailTab={setRightRailTab}
        >
          <section className={`media-sidebar table-right-panel ${rightRailTab === 'media' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Медиа стола')}>
            {!isMaster ? (
              <nav className="sub-tabs" aria-label={t('Медиа панели')}>
                <button type="button" className={mediaTab === 'layers' ? 'active' : ''} onClick={() => setMediaTab('layers')}>
                  {t('Стол')}
                </button>
                <button type="button" className={mediaTab === 'library' ? 'active' : ''} onClick={() => setMediaTab('library')}>
                  {t('Мои медиа')}
                </button>
                <button type="button" className={mediaTab === 'music' ? 'active' : ''} onClick={() => setMediaTab('music')}>
                  {t('Музыка')}
                </button>
              </nav>
            ) : null}

            {!isMaster ? (
            <section
              className={`layer-panel table-right-panel ${mediaTab === 'layers' ? '' : 'table-right-panel-hidden'}`}
              aria-label={t('Слои стола')}
              onDragOver={event => {
                if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/uri-list') || event.dataTransfer.types.includes('text/plain')) event.preventDefault()
              }}
              onDrop={handleTableLayerPanelDrop}
            >
              <header>
                <strong>{t('Изображения и видео')}</strong>
                <span>{selectedManagerLayer?.name || t('папки выше перекрывают ниже')}</span>
              </header>

              <div className="media-manager-toolbar">
                <button type="button" onClick={() => createNamedFolder()}>{t('Папка')}</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? t('Загрузка...') : t('Новый слой')}
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
                  {t('Папка файлов')}
                </button>
              </div>

              <form className="media-url-form" onSubmit={handleMediaUrlSubmit}>
                <input
                  value={mediaUrlDraft}
                  onChange={event => setMediaUrlDraft(event.target.value)}
                  placeholder={t('Ссылка на картинку, видео или YouTube')}
                  disabled={isUploading}
                />
                <button type="submit" disabled={isUploading || !mediaUrlDraft.trim()}>
                  {t('Вставить')}
                </button>
              </form>

              <div
                className={`layer-list ${layerDropTarget?.layerId === ROOT_LAYER_DROP_ID ? 'drop-root' : ''}`}
                onDragOver={handleLayerRootDragOver}
                onDrop={handleLayerRootDrop}
                onDragLeave={event => {
                  if (event.currentTarget === event.target) setLayerDropTarget(null)
                }}
              >
                {layerTree.length === 0 ? (
                  <p className="panel-empty">{t('Слоёв пока нет.')}</p>
                ) : (
                  <LayerManager layers={layerTree}
                            isMaster={isMaster}
                            expandedFolders={expandedFolders}
                            layerDropTarget={layerDropTarget}
                            selectedLayerIds={selectedLayerIds}
                            draggingLayerId={draggingLayerId}
                            canMoveLayer={canMoveLayer}
                            isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
                            handleLayerDragStart={handleLayerDragStart}
                            handleLayerDragOver={handleLayerDragOver}
                            handleLayerDrop={handleLayerDrop}
                            handleLayerDragEnd={handleLayerDragEnd}
                            handleManagerDoubleClick={handleManagerDoubleClick}
                            patchLayer={patchLayer}
                            placeLayerOnTable={placeLayerOnTable}
                            deleteLayer={deleteLayer}
                            setLayerSelection={setLayerSelection}
                            setLayerContextMenu={setLayerContextMenu}
                            toggleFolder={toggleFolder}
                          />
                )}
                <div
                  className="layer-root-drop-zone"
                  onDragOver={handleLayerRootDragOver}
                  onDrop={handleLayerRootDrop}
                >
                  {t('Перетащи сюда, чтобы вынести в корень')}
                </div>
              </div>
            </section>
            ) : null}

            {!isMaster ? (
            <MediaLibrary
              mediaTab={mediaTab}
              isMaster={isMaster}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              mediaSearchDraft={mediaSearchDraft}
              textMaterialNameDraft={textMaterialNameDraft}
              textMaterialDraft={textMaterialDraft}
              libraryTree={libraryTree}
              layerDropTarget={layerDropTarget}
              expandedFolders={expandedFolders}
              selectedLayerIds={selectedLayerIds}
              draggingLayerId={draggingLayerId}
              createNamedFolder={createNamedFolder}
              setMediaSearchDraft={setMediaSearchDraft}
              setTextMaterialNameDraft={setTextMaterialNameDraft}
              setTextMaterialDraft={setTextMaterialDraft}
              createTextMaterial={createTextMaterial}
              handleLayerRootDragOver={handleLayerRootDragOver}
              handleLayerRootDrop={handleLayerRootDrop}
              uploadFiles={uploadFiles}
              setLayerDropTarget={setLayerDropTarget}
              canMoveLayer={canMoveLayer}
              isLayerEffectivelyVisible={checkLayerEffectivelyVisible}
              handleLayerDragStart={handleLayerDragStart}
              handleLayerDragOver={handleLayerDragOver}
              handleLayerDrop={handleLayerDrop}
              handleLayerDragEnd={handleLayerDragEnd}
              handleManagerDoubleClick={handleManagerDoubleClick}
              patchLayer={patchLayer}
              placeLayerOnTable={placeLayerOnTable}
              deleteLayer={deleteLayer}
              setLayerSelection={setLayerSelection}
              setLayerContextMenu={setLayerContextMenu}
              toggleFolder={toggleFolder}
            />
            ) : null}

            {!isMaster && mediaTab === 'music' ? (
              <div className="table-right-panel" style={{ overflow: 'auto' }}>
                <MusicPlayer room={room} tableRole={tableRole} channelRef={channelRef} playbackEnabled={false} />
              </div>
            ) : null}
          </section>

          <section className={`roll-sidebar table-right-panel ${rightRailTab === 'rolls' ? '' : 'table-right-panel-hidden'}`} aria-label={t('История бросков')}>
            <section className="roll-list">
              {rolls.length === 0 ? (
                <p className="panel-empty">{t('Бросков пока нет.')}</p>
              ) : (
                rolls.map(roll => {
                  const rerollDraftForRoll = willpowerRerollDraft?.rollId === roll.id ? willpowerRerollDraft : null
                  const canRerollWithWillpower = canUseWillpowerReroll(roll)
                  const contestedRequest = roll.meta?.rollMode === 'contested' && roll.meta.contested?.status === 'requested'
                  return (
                  <article className={`roll-card ${roll.hidden ? 'hidden-roll' : ''}`} key={roll.id}>
                    <div className="roll-meta">
                      <strong>{roll.characterName}</strong>
                      {roll.hidden ? <span className="roll-hidden-badge">{t('скрытый')}</span> : null}
                      <time dateTime={roll.createdAt}>{formatTime(roll.createdAt)}</time>
                    </div>
                    <span className="roll-pool">{t(roll.poolName)}</span>

                    {contestedRequest ? (
                      <div className="contested-request-result">
                        <strong>{t('Запрошен встречный бросок')}</strong>
                        <span>{tf('Пул инициатора: {pool}, {count}.', { pool: roll.meta?.contested?.initiatorPoolName || d10(roll.diceCount), count: d10(roll.meta?.contested?.initiatorDiceCount || roll.diceCount) })}</span>
                        <span>{tf('Оппонент: {name}.', { name: roll.meta?.contested?.opponentName || t('не выбран') })}</span>
                        <small>{t('Ожидается ответный бросок.')}</small>
                      </div>
                    ) : roll.poolType === 'humanity-event' ? (
                      <div className="humanity-history-event">{t('Событие Человечности')}</div>
                    ) : roll.opposed ? (
                      <div className="opposed-roll-result">
                        <strong className={`opposed-result-badge outcome-${roll.opposed.outcome}`}>{roll.opposed.summary}</strong>
                        {roll.opposed.sides.map(side => {
                          const sideOutcome = roll.opposed?.winnerSideId === side.id ? 'winner' : roll.opposed?.winnerSideId ? 'loser' : 'tie'
                          return (
                            <section className={`opposed-result-side ${sideOutcome}`} key={`${roll.id}-${side.id}`}>
                              <div>
                                <strong>{side.actorName}</strong>
                                <span>{t(side.poolName)}</span>
                              </div>
                              <div className="dice-row" aria-label={tf('Результаты кубиков {actor}: {values}', { actor: side.actorName, values: side.dice.map(die => die.value).join(', ') })}>
                                {side.dice.map((die, index) => {
                                  const dieImage = getDieImage(die)
                                  const dieLabel = t(dieImage.label)
                                  return (
                                    <span
                                      className={`die die-${die.kind}`}
                                      key={`${roll.id}-${side.id}-${index}`}
                                      aria-label={`${dieLabel}: ${die.value}`}
                                      title={`${die.value} - ${dieLabel}`}
                                    >
                                      <img src={dieImage.src} alt="" draggable={false} />
                                    </span>
                                  )
                                })}
                              </div>
                              <footer>
                                <span>{d10(side.diceCount)}</span>
                                <strong>{side.successes}</strong>
                              </footer>
                            </section>
                          )
                        })}
                      </div>
                    ) : (
                      <>
                        <WillpowerRerollControls
                          roll={roll}
                          canReroll={canRerollWithWillpower}
                          draft={rerollDraftForRoll}
                          onToggleDie={dieId => toggleWillpowerRerollDie(roll, dieId)}
                          onStartReroll={() => setWillpowerRerollDraft({ rollId: roll.id, selectedDieIds: [] })}
                          onCancelReroll={() => setWillpowerRerollDraft(null)}
                          onConfirmReroll={() => confirmWillpowerReroll(roll)}
                        />
                        {!['health', 'rouse-check', 'remorse-check', 'humanity-event'].includes(roll.poolType) && !contestedRequest && chatCharacters.length ? (
                          <div className="roll-health-actions">
                            <button type="button" onClick={() => applyRollDamage(roll)}>
                              {t('Применить урон к цели')}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                    {roll.opposed && chatCharacters.length ? (
                      <div className="roll-health-actions">
                        <button type="button" onClick={() => applyRollDamage(roll)}>
                          {t('Применить урон к цели')}
                        </button>
                      </div>
                    ) : null}
                    {renderRollMeta(roll)}
                  </article>
                )})
              )}
            </section>
          </section>

          <ChatPanel
            rightRailTab={rightRailTab}
            chatMessages={chatMessages}
            chatStatus={chatStatus}
            chatUser={chatUser}
            roomParticipants={roomParticipants}
            chatCharacters={chatCharacters}
            selectedChatCharacterId={selectedChatCharacterId}
            chatAuthMode={chatAuthMode}
            chatUsernameDraft={chatUsernameDraft}
            chatPasswordDraft={chatPasswordDraft}
            isChatBusy={isChatBusy}
            chatPanelTab={chatPanelTab}
            voiceStatus={voiceStatus}
            voiceEnabled={voiceEnabled}
            voiceMuted={voiceMuted}
            voiceMasterVolume={voiceMasterVolume}
            voiceQuality={voiceQuality}
            voiceParticipants={voiceParticipants}
            chatDraft={chatDraft}
            voiceAudioRefs={voiceAudioRefs}
            remoteStreamsRef={remoteStreamsRef}
            formatTime={formatTime}
            openParticipantPreview={openParticipantPreview}
            logoutChat={handleLogoutChat}
            chooseActiveCharacter={chooseActiveCharacter}
            handleChatAuth={handleChatAuth}
            setChatAuthMode={setChatAuthMode}
            setChatUsernameDraft={setChatUsernameDraft}
            setChatPasswordDraft={setChatPasswordDraft}
            setChatPanelTab={setChatPanelTab}
            startVoice={startVoice}
            stopVoice={stopVoice}
            toggleVoiceMuted={toggleVoiceMuted}
            setVoiceMasterVolume={setVoiceMasterVolume}
            setVoiceQuality={setVoiceQuality}
            setVoiceStatus={setVoiceStatus}
            setVoiceParticipantVolume={setVoiceParticipantVolume}
            sendChatMessage={sendChatMessage}
            setChatDraft={setChatDraft}
          />

          {isMaster ? (
            <section className={`master-roll-sidebar table-right-panel ${rightRailTab === 'diary' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Персонажи мастера')}>
              <header>
                <div>
                  <span>{t('Персонажи')}</span>
                  <strong>{chatCharacters.length}</strong>
                </div>
                <div>
                  <span>{t('Бросок')}</span>
                  <strong>{masterRollHidden ? t('скрытый') : t('открытый')}</strong>
                </div>
              </header>

              {!chatUser ? (
                <div className="master-roll-empty">
                  <p>{t('Войди в чат, чтобы увидеть своих персонажей.')}</p>
                  <button type="button" onClick={() => setRightRailTab('chat')}>{t('Открыть чат')}</button>
                </div>
              ) : chatCharacters.length === 0 ? (
                <div className="master-roll-empty">
                  <p>{t('Сохранённых персонажей пока нет.')}</p>
                  <a href={getCharacterSheetHref()}>{t('Создать лист')}</a>
                </div>
              ) : (
                <div className="master-roll-layout">
                  <aside className="master-roll-character-list" aria-label={t('Персонажи для бросков')}>
                    {chatCharacters.map(character => (
                      <button
                        type="button"
                        key={character.id}
                        className={character.id === selectedMasterRollCharacter?.id ? 'active' : ''}
                        onClick={() => chooseMasterRollCharacter(character.id)}
                      >
                        <span className="chat-avatar" aria-hidden="true">
                          {character.image ? <img src={character.image} alt="" /> : <i>{(character.name || '?').slice(0, 1).toUpperCase()}</i>}
                        </span>
                        <span>
                          <strong>{character.name || t('Безымянный')}</strong>
                          <small>{character.clan || t('без клана')}</small>
                        </span>
                      </button>
                    ))}
                  </aside>

                  <section className="master-roll-builder" aria-label={t('Бросок персонажа мастера')}>
                    {selectedMasterRollCharacter ? (
                      <>
                        <div className="master-roll-current">
                          <div className="chat-avatar large" aria-hidden="true">
                            {selectedMasterRollCharacter.image ? (
                              <img src={selectedMasterRollCharacter.image} alt="" />
                            ) : (
                              <span>{(selectedMasterRollCharacter.name || '?').slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span>{t('Выбран')}</span>
                            <strong>{selectedMasterRollCharacter.name}</strong>
                            <small>{tf('{clan} · Голод {hunger}/5 · Воля {willpowerCurrent}/{willpowerMax} · Сила Крови {bloodPotency}', {
                              clan: selectedMasterRollCharacter.clan || t('без клана'),
                              hunger: getCharacterHunger(selectedMasterRollCharacter),
                              willpowerCurrent: getCharacterWillpower(selectedMasterRollCharacter).current,
                              willpowerMax: getCharacterWillpower(selectedMasterRollCharacter).max,
                              bloodPotency: masterBloodPotency
                            })}</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void openCharacterPreview(selectedMasterRollCharacter)
                              setPreviewCharacterTab('mechanics')
                            }}
                          >
                            {t('Просмотр')}
                          </button>
                          <a href={getCharacterSheetHref(selectedMasterRollCharacter.id)}>{t('Лист')}</a>
                        </div>

                        <div className="master-roll-mode" aria-label={t('Видимость броска')}>
                          <button
                            type="button"
                            className={masterRollVisibility === 'public' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('public')}
                          >
                            {t('Открытый')}
                          </button>
                          <button
                            type="button"
                            className={masterRollVisibility === 'hidden' ? 'active' : ''}
                            onClick={() => setMasterRollVisibility('hidden')}
                          >
                            {t('Скрытый')}
                          </button>
                        </div>

                        <div className="preview-roll-controls master-roll-controls">
                          <label>
                            <span>{t('Характеристика 1')}</span>
                            <select value={masterRollAttribute} onChange={event => setMasterRollAttribute(event.target.value)}>
                              <option value="">{t('Без характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={group.name}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttributeTwo === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Характеристика 2')}</span>
                            <select value={masterRollAttributeTwo} onChange={event => setMasterRollAttributeTwo(event.target.value)}>
                              <option value="">{t('Без второй характеристики')}</option>
                              {ATTRIBUTE_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{t(name)} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraAttributes.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraAttributes.map(name => <option key={name} value={name} disabled={masterRollAttribute === name}>{name} · {getAttributeDots(selectedMasterRollCharacter.attributes, name)}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Навык')}</span>
                            <select value={masterRollSkill} onChange={event => setMasterRollSkill(event.target.value)}>
                              <option value="">{t('Без навыка')}</option>
                              {SKILL_GROUPS.map(group => (
                                <optgroup key={group.name} label={t(group.name)}>
                                  {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ))}
                              {masterRollExtraSkills.length ? (
                                <optgroup label={t('Другие')}>
                                  {masterRollExtraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(selectedMasterRollCharacter.skills, name))}</option>)}
                                </optgroup>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{t('Дисциплина')}</span>
                            <select value={masterRollDiscipline} onChange={event => setMasterRollDiscipline(event.target.value)}>
                              <option value="">{t('Без дисциплины')}</option>
                              {masterRollDisciplineNames.map(name => (
                                <option key={name} value={name}>{name} · {getDisciplineDots(selectedMasterRollCharacter.disciplines[name] || {})}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{t('Модификатор')}</span>
                            <input
                              type="number"
                              min="-20"
                              max="20"
                              value={masterRollModifier}
                              onChange={event => setMasterRollModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                            />
                          </label>
                          <label className="preview-blood-surge-toggle">
                            <span>{tf('Прилив Крови +{bonus}к10', { bonus: masterBloodSurgeBonus })}</span>
                            <input
                              type="checkbox"
                              checked={masterUseBloodSurge}
                              onChange={event => setMasterUseBloodSurge(event.target.checked)}
                            />
                          </label>
                          <label className="roll-mode-field">
                            <span>{t('Тип броска')}</span>
                            <select
                              value={masterRollMode}
                              onChange={event => {
                                const nextMode = event.target.value as RollMode
                                setMasterRollMode(nextMode)
                                if (nextMode === 'normal') setMasterContestedOpponentId('')
                              }}
                            >
                              <option value="normal">{t('Обычный бросок')}</option>
                              <option value="contested">{t('Встречный бросок')}</option>
                            </select>
                          </label>
                          {masterRollMode === 'contested' ? (
                            <label className="contested-opponent-field">
                              <span>{t('Оппонент')}</span>
                              <select
                                value={masterContestedOpponentId}
                                onChange={event => setMasterContestedOpponentId(event.target.value)}
                                disabled={masterContestedOpponentOptions.length === 0}
                              >
                                <option value="">{masterContestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}</option>
                                {masterContestedOpponentOptions.map(option => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className="preview-roll-submit"
                            onClick={rollMasterPool}
                            disabled={masterRollDiceCount < 1 || (masterRollMode === 'contested' && !selectedMasterContestedOpponent)}
                          >
                            {masterRollMode === 'contested' ? t('Запросить встречный') : t('Бросить')} {d10(Math.min(20, masterRollDiceCount + (masterUseBloodSurge ? masterBloodSurgeBonus : 0)) || 0)}
                          </button>
                        </div>

                        <RollModifierControls result={masterRollEffectResult} isMaster={isMaster} setDisabledIds={setDisabledMasterRollModifierIds} />

                        <div className="quick-roll-grid master-quick-rolls" aria-label={t('Быстрые броски мастера')}>
                          {[1, 3, 5, 7, 10].map(count => (
                            <button type="button" key={count} onClick={() => rollMasterQuick(count)}>
                              {d10(count)}
                            </button>
                          ))}
                        </div>

                        <div className="master-roll-traits">
                          {ATTRIBUTE_GROUPS.map(group => (
                            <section key={group.name}>
                              <strong>{t(group.name)}</strong>
                              {group.traits.map(name => {
                                const dots = getAttributeDots(selectedMasterRollCharacter.attributes, name)
                                return (
                                  <button
                                    type="button"
                                    key={name}
                                    className={masterRollAttribute === name || masterRollAttributeTwo === name ? 'active' : ''}
                                    onClick={() => toggleMasterRollAttribute(name)}
                                  >
                                    <span>{t(name)}</span>
                                    <i>{getDotDisplay(dots)}</i>
                                  </button>
                                )
                              })}
                            </section>
                          ))}
                        </div>

                        {masterRollPoolBeforeLimit > 20 ? <p className="preview-roll-notice">{t('Пул ограничен двадцатью костями.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'willpower_impairment') ? <p className="preview-roll-notice">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                        {getActivePenaltyDelta(masterRollEffectResult, 'health_impairment') ? <p className="preview-roll-notice">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
                      </>
                    ) : (
                      <p className="panel-empty">{t('Выбери персонажа.')}</p>
                    )}
                  </section>
                </div>
              )}
            </section>
          ) : (
            <JournalPanel
              rightRailTab={rightRailTab}
              journalEntries={journalEntries}
              journalSaveStatus={journalSaveStatus}
              chatUser={chatUser}
              journalSearch={journalSearch}
              filteredJournalEntries={filteredJournalEntries}
              selectedJournalEntry={selectedJournalEntry}
              setJournalSearch={setJournalSearch}
              createJournalEntry={createJournalEntry}
              setSelectedJournalEntryId={setSelectedJournalEntryId}
              updateJournalEntry={updateJournalEntry}
              persistCurrentJournal={persistCurrentJournal}
              deleteJournalEntry={deleteJournalEntry}
              addLayerToJournal={addLayerToJournal}
            />
          )}

          <MasterPanel
            rightRailTab={rightRailTab}
            isMaster={isMaster}
            masterReveals={masterReveals}
            visibleMasterWhispers={visibleMasterWhispers}
            room={room}
            chatUser={chatUser}
            selectedMasterChatUserId={selectedMasterChatUserId}
            masterChatPlayers={masterChatPlayers}
            masterChatDraft={masterChatDraft}
            formatTime={formatTime}
            setSelectedMasterChatUserId={setSelectedMasterChatUserId}
            setMasterChatDraft={setMasterChatDraft}
            sendMasterWhisper={sendMasterWhisper}
          />
        </TableRightPanel>
      </section>

      <OpposedRollModal
        open={Boolean(incomingOpposedProposal)}
        proposal={incomingOpposedProposal}
        activeCharacter={selectedActiveCharacter}
        responseSide={opposedResponseSide}
        responsePool={{
          diceCount: opposedResponsePool.diceCount,
          extraAttributes: opposedResponsePool.extraAttributes,
          extraSkills: opposedResponsePool.extraSkills,
          disciplineNames: opposedResponsePool.disciplineNames,
        }}
        canAnswer={canAnswerOpposedProposal}
        onDismiss={dismissOpposedProposal}
        onAnswer={answerOpposedProposal}
        onResponseSideChange={updateOpposedResponseSide}
      />

      {previewCharacter ? (
        <CharacterPreviewModal
          character={previewCharacter}
          state={{
            tab: previewCharacterTab,
            roll: {
              attribute: previewRollAttribute,
              attributeTwo: previewRollAttributeTwo,
              skill: previewRollSkill,
              discipline: previewRollDiscipline,
              modifier: previewRollModifier,
              mode: previewRollMode,
              contestedOpponentId: previewContestedOpponentId,
              useBloodSurge: previewUseBloodSurge,
            },
            inventory: {
              name: quickInventoryName,
              category: quickInventoryCategory,
              quantity: quickInventoryQuantity,
              status: quickInventoryStatus,
              isBusy: isQuickInventoryBusy,
            },
          }}
          computed={{
            usesVampireResources: previewUsesVampireResources,
            hunger: previewHunger,
            health: previewHealth,
            willpower: previewWillpower,
            humanity: previewHumanity,
            bloodPotency: previewBloodPotency,
            sheetFixed: previewSheetFixed,
            damageProfile: previewDamageProfile,
            healthDerived: previewHealthDerived,
            willpowerDerived: previewWillpowerDerived,
            canRoll: canRollPreview,
            canEditInventory: canEditPreviewInventory,
            canEditActiveEffects: canEditPreviewActiveEffects,
            extraAttributes: previewExtraAttributes,
            extraSkills: previewExtraSkills,
            disciplineNames: previewDisciplineNames,
            diceCount: previewDiceCount,
            poolBeforeLimit: previewPoolBeforeLimit,
            bloodSurgeBonus: previewBloodSurgeBonus,
            bloodSurgeEnabled: previewBloodSurgeEnabled,
            rollEffectResult: previewRollEffectResult,
            contestedOpponentOptions: previewContestedOpponentOptions,
            selectedContestedOpponent: selectedPreviewContestedOpponent,
            willpowerRecoveryPool: getWillpowerRecoveryPool(previewCharacter),
            playerLabel: previewCharacter.username || chatUser?.username || t('Игрок'),
          }}
          actions={{
            onTabChange: setPreviewCharacterTab,
            onClose: () => setPreviewCharacter(null),
            setRollAttribute: setPreviewRollAttribute,
            setRollAttributeTwo: setPreviewRollAttributeTwo,
            setRollSkill: setPreviewRollSkill,
            setRollDiscipline: setPreviewRollDiscipline,
            setRollModifier: setPreviewRollModifier,
            setRollMode: setPreviewRollMode,
            setContestedOpponentId: setPreviewContestedOpponentId,
            setUseBloodSurge: setPreviewUseBloodSurge,
            toggleRollAttribute: togglePreviewAttribute,
            rollPool: rollPreviewPool,
            rollQuickDice: (count, label) => rollQuickDice(count, label, previewCharacter, 'quick', {
              useBloodSurge: previewBloodSurgeEnabled,
              source: previewBloodSurgeEnabled ? 'blood_surge' : 'manual',
            }),
            openDiscipline: openPreviewDiscipline,
            rollRouseCheck: () => rollRouseCheck(previewCharacter),
            quenchHunger: amount => quenchHunger(previewCharacter, amount),
            addHumanityStains: amount => addHumanityStains(previewCharacter, amount),
            performRemorseCheck: () => performRemorseCheck(previewCharacter),
            applyHealthDamage: (amount, severity, options) => applyCharacterHealthDamage(previewCharacter, amount, severity, options),
            promptHealthDamage: () => promptCharacterHealthDamage(previewCharacter),
            recoverHealth: (amount, severity, reason, source) => recoverCharacterHealth(previewCharacter, amount, severity, reason, source),
            mendSuperficial: () => mendVampireSuperficial(previewCharacter),
            mendAggravated: () => mendVampireAggravated(previewCharacter),
            recoverMortalHealth: () => recoverMortalHealth(previewCharacter),
            treatMortalHealth: () => treatMortalHealth(previewCharacter),
            clearHealth: clearPreviewHealth,
            markTorporOrComa: markPreviewTorporOrComa,
            spendWillpower: (amount, reason) => spendWillpower(previewCharacter, amount, reason),
            rollWillpowerCheck: () => rollWillpowerCheck(previewCharacter),
            recoverWillpower: (amount, severity, reason) => recoverWillpower(previewCharacter, amount, severity, reason),
            confirmRecoverAggravatedWillpower: confirmRecoverPreviewAggravatedWillpower,
            adjustWillpowerStress: (severity, delta) => adjustWillpowerStress(previewCharacter, severity, delta),
            removeActiveEffect: removePreviewActiveEffect,
            setQuickInventoryName: setQuickInventoryName,
            setQuickInventoryCategory: setQuickInventoryCategory,
            setQuickInventoryQuantity: setQuickInventoryQuantity,
            addQuickInventoryItem,
            showInventoryItemToMaster,
            onAddExperience: addExperienceToActiveCharacter,
            renderRollModifierControls: result => (
              <RollModifierControls result={result} isMaster={isMaster} setDisabledIds={setDisabledPreviewRollModifierIds} />
            ),
          }}
          isMaster={isMaster}
          isActiveCharacter={previewCharacter.id === selectedActiveCharacter?.id}
          characterSheetHref={getCharacterSheetHref(previewCharacter.id)}
        />
      ) : null}


      <DisciplinePowerPanel
        open={Boolean(previewCharacter && previewDisciplineName)}
        disciplineName={previewDisciplineName}
        openedDisciplineDots={previewOpenedDisciplineDots}
        disciplineRulesStatus={disciplineRulesStatus}
        disciplineRule={previewDisciplineRule}
        disciplinePowers={previewDisciplinePowers}
        selectedPowerName={previewPowerName}
        onSelectPower={setPreviewPowerName}
        selectedPower={selectedPreviewPower}
        selectedPowerRollSummary={selectedPreviewPowerRollSummary}
        selectedPowerDifficultySummary={selectedPreviewPowerDifficultySummary}
        selectedPowerCost={selectedPreviewPowerCost}
        selectedPowerCostLabel={selectedPreviewPowerCostLabel}
        selectedPowerManualPrompts={selectedPreviewPowerManualPrompts}
        selectedPowerInputFields={selectedPreviewPowerInputFields}
        powerInputValues={previewPowerInputValues}
        onPowerInputChange={(fieldId, value) => setPreviewPowerInputValues(current => ({
          ...current,
          [fieldId]: value,
        }))}
        hasMissingPowerInput={hasMissingPreviewPowerInput}
        powerDiceCount={previewPowerDiceCount}
        powerPoolChoices={previewPowerPoolChoices}
        powerPoolSelections={previewPowerPoolSelections}
        onPowerPoolSelectionChange={(index, value) => setPreviewPowerPoolSelections(current => current.map((poolValue, currentIndex) => currentIndex === index ? value : poolValue))}
        powerModifier={previewPowerModifier}
        onPowerModifierChange={setPreviewPowerModifier}
        selectedPowerIsActive={selectedPreviewPowerIsActive}
        selectedPowerIsActiveKind={selectedPreviewPowerIsActiveKind}
        onDeactivatePower={deactivatePreviewDisciplinePower}
        onRollPower={rollPreviewPower}
        canRoll={canRollPreview}
        rollModifierControls={(
          <RollModifierControls
            result={previewPowerRollEffectResult}
            isMaster={isMaster}
            setDisabledIds={setDisabledPreviewPowerModifierIds}
          />
        )}
        powerOpposition={previewPowerOpposition}
        selectedPowerRollFormula={selectedPreviewPowerRollFormula}
        resolvedPowerPool={resolvedPreviewPowerPool}
        hasWillpowerImpairmentPenalty={Boolean(getActivePenaltyDelta(previewPowerRollEffectResult, 'willpower_impairment'))}
        hasHealthImpairmentPenalty={Boolean(getActivePenaltyDelta(previewPowerRollEffectResult, 'health_impairment'))}
        getPoolPartDots={name => previewCharacter ? getCharacterPoolPartDots(previewCharacter, name) : 0}
        onClose={() => setPreviewDisciplineName('')}
      />

      {previewLayer ? (
        <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('Предпросмотр медиа')} onMouseDown={() => setPreviewLayerId(null)}>
          <section className="media-preview-modal" onMouseDown={event => event.stopPropagation()}>
            <header>
              <div>
                <span>{previewLayer.ownerRole === 'master' ? t('Мастер') : t('Игрок')}</span>
                <strong>{previewLayer.name}</strong>
              </div>
              <button type="button" onClick={() => setPreviewLayerId(null)} aria-label={t('Закрыть предпросмотр')}>×</button>
            </header>
            <div className="media-preview-body">
              {previewLayer.layerType === 'image' ? (
                <img src={previewLayer.imageData} alt={previewLayer.name} />
              ) : previewLayer.layerType === 'video' ? (
                getEmbeddableVideoUrl(previewLayer.imageData) ? (
                  <iframe
                    src={getEmbeddableVideoUrl(previewLayer.imageData)}
                    title={previewLayer.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video src={previewLayer.imageData} controls playsInline />
                )
              ) : previewLayer.layerType === 'text' ? (
                <article className="preview-text-material" dangerouslySetInnerHTML={{ __html: previewLayer.imageData }} />
              ) : previewLayer.layerType === 'file' ? (() => {
                const meta = getFileLayerMeta(previewLayer.imageData, previewLayer.name)
                const embedUrl = getDocumentEmbedUrl(meta)
                return embedUrl ? (
                  <iframe src={embedUrl} title={previewLayer.name} />
                ) : (
                  <article className="preview-file-card">
                    <strong>{previewLayer.name}</strong>
                    <span>{meta.type}</span>
                    <a href={meta.url} target="_blank" rel="noreferrer">{t('Открыть файл')}</a>
                  </article>
                )
              })() : null}
            </div>
          </section>
        </div>
      ) : null}

      {layerContextMenu ? (() => {
        const layer = layers.find(item => item.id === layerContextMenu.layerId)
        const ids = getContextLayerIds(layerContextMenu.layerId)
        const contextLayers = ids
          .map(id => layers.find(item => item.id === id))
          .filter((item): item is TableLayer => Boolean(item))
        if (contextLayers.length === 0) return null
        const firstLayer = layer || contextLayers[0]
        const allVisible = contextLayers.every(item => item.visible)
        const allLocked = contextLayers.every(item => item.locked)
        const singleLayer = contextLayers.length === 1 ? contextLayers[0] : null
        const canManageContext = contextLayers.every(item => canEditLayer(item))
        const movableIds = canManageContext ? ids.filter(id => layers.find(item => item.id === id)?.layerType !== 'folder') : []
        const folderScope = firstLayer.onTable ? tableManagerLayers : libraryLayers
        const availableFolders = canManageContext ? folderScope.filter(item => item.layerType === 'folder' && !ids.includes(item.id)) : []
        if (!canManageContext && (!singleLayer || singleLayer.layerType === 'folder')) return null
        return (
          <SmartContextMenu
            x={layerContextMenu.x}
            y={layerContextMenu.y}
            onClick={event => event.stopPropagation()}
          >
            {singleLayer && singleLayer.layerType !== 'folder' ? (
              <>
                {/* Add to journal — available to all players for any visible layer */}
                {chatUser && !isMaster && singleLayer.layerType === 'image' ? (
                  <button
                    type="button"
                    style={{ fontWeight: 600, color: '#ffd89a', borderColor: 'rgba(214,170,101,0.5)' }}
                    onClick={() => addLayerToJournal(singleLayer.imageData, singleLayer.name)}
                  >
                    📖 {t('Добавить в дневник')}
                  </button>
                ) : null}
                <div className="context-menu-group">
                  <span>{t('Копировать')}</span>
                  <button type="button" onClick={() => copyLayerForDiary(singleLayer)}>{t('Для дневника')}</button>
                  <button type="button" onClick={() => copyLayerUrl(singleLayer)}>{t('Ссылку')}</button>
                  <button type="button" onClick={() => copyLayerToPersonalMedia(singleLayer)}>{t('В мои медиа')}</button>
                </div>
              </>
            ) : null}
            {canManageContext ? (
              <>
                {singleLayer ? <button type="button" onClick={() => renameLayer(singleLayer)}>{t('Переименовать')}</button> : null}
                {singleLayer && ['image', 'video'].includes(singleLayer.layerType) ? (
                  <div className="context-menu-group">
                    <span>{t('Изображение')}</span>
                    <button type="button" onClick={() => openImageEditor(singleLayer)}>{t('Обрезать')}</button>
                    <button type="button" onClick={() => patchLayer(singleLayer.id, { rotation: (singleLayer.rotation + 90) % 360 })}>{t('Повернуть')}</button>
                    <button type="button" onClick={() => duplicateLayer(singleLayer)}>{t('Дублировать')}</button>
                  </div>
                ) : null}
                {singleLayer && getLayerCrop(singleLayer).cropped ? (
                  <button type="button" onClick={() => resetLayerCrop(singleLayer)}>{t('Восстановить обрезанное')}</button>
                ) : null}
                <button type="button" onClick={() => {
                  patchSelectedLayers(ids, () => ({ visible: !allVisible }))
                  setLayerContextMenu(null)
                }}>
                  {allVisible ? t('Скрыть') : t('Показать')}
                </button>
                <button type="button" onClick={() => {
                  patchSelectedLayers(ids, () => ({ locked: !allLocked }))
                  setLayerContextMenu(null)
                }}>
                  {allLocked ? t('Разблокировать') : t('Заблокировать')}
                </button>
                {singleLayer && singleLayer.layerType !== 'folder' ? (
                  <div className="context-menu-group context-menu-controls">
                    <span>{t('Слой')}</span>
                    <label>
                      <small>Opacity</small>
                      <input
                        key={`${singleLayer.id}:${singleLayer.opacity}`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        defaultValue={singleLayer.opacity}
                        data-committed-value={singleLayer.opacity}
                        onInput={event => previewLayerOpacity(singleLayer.id, Number(event.currentTarget.value))}
                        onPointerUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onPointerCancel={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onKeyUp={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                        onBlur={event => commitLayerOpacity(singleLayer.id, event.currentTarget)}
                      />
                    </label>
                    <label>
                      <small>Blend</small>
                      <select
                        value={singleLayer.blendMode}
                        onChange={event => patchLayer(singleLayer.id, { blendMode: event.target.value as BlendMode })}
                      >
                        {(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'luminosity'] as BlendMode[]).map(mode => (
                          <option value={mode} key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                <div className="context-menu-group">
                  <span>{t('Порядок слоя')}</span>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'top')
                    setLayerContextMenu(null)
                  }}>{t('На самый верх')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'up')
                    setLayerContextMenu(null)
                  }}>{t('Выше')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'down')
                    setLayerContextMenu(null)
                  }}>{t('Ниже')}</button>
                  <button type="button" onClick={() => {
                    reorderLayers(ids, 'bottom')
                    setLayerContextMenu(null)
                  }}>{t('На самый низ')}</button>
                </div>
                {singleLayer?.layerType === 'folder' ? (
                  <button type="button" onClick={() => {
                    createNamedFolder(singleLayer.id, singleLayer.onTable)
                    setLayerContextMenu(null)
                  }}>{t('Новая папка внутри')}</button>
                ) : null}
                {contextLayers.some(item => item.parentId) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Вынести из папки')}</button>
                ) : null}
                {contextLayers.some(item => item.onTable) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ onTable: false, parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Убрать в медиа сцены')}</button>
                ) : null}
                {contextLayers.some(item => !item.onTable) ? (
                  <button type="button" onClick={() => {
                    patchSelectedLayers(ids, () => ({ onTable: true, visible: true, parentId: null }))
                    setLayerContextMenu(null)
                  }}>{t('Вынести на стол')}</button>
                ) : null}
                {movableIds.length > 0 ? (
                  <div className="context-menu-group">
                    <span>{t('Поместить в папку')}</span>
                    {availableFolders.map(folder => (
                      <button type="button" key={folder.id} onClick={() => {
                        moveLayersToFolder(movableIds, folder.id)
                        setLayerContextMenu(null)
                      }}>{folder.name}</button>
                    ))}
                    <button type="button" onClick={() => {
                      createFolderForSelection(movableIds)
                      setLayerContextMenu(null)
                    }}>{t('Создать новую папку')}</button>
                  </div>
                ) : null}
                <button type="button" onClick={() => {
                  focusLayersForEveryone(ids.length > 0 ? ids : [firstLayer.id])
                  setLayerContextMenu(null)
                }}>{t('Указать всем')}</button>
                <button type="button" className="danger" onClick={() => {
                  deleteSelectedLayers(ids)
                  setLayerContextMenu(null)
                }}>{t('Удалить')}</button>
              </>
            ) : null}
          </SmartContextMenu>
        )
      })() : null}

      <MasterPasswordGate
        open={!tableRole}
        masterPasswordDraft={masterPasswordDraft}
        onMasterPasswordDraftChange={setMasterPasswordDraft}
        onEnterAsMaster={enterAsMaster}
        onChoosePlayer={() => chooseTableRole('player')}
      />

      {diceOverlayQueue[0] ? (
        <DiceRollOverlay
          key={diceOverlayQueue[0].id}
          roll={diceOverlayQueue[0]}
          onDone={() => setDiceOverlayQueue(prev => prev.slice(1))}
        />
      ) : null}

      <GameTableStyles />
    </main>
  )
}

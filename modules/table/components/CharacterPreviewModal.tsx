'use client'

import type { FormEvent, ReactNode } from 'react'
import type { CharacterDerivedStats } from '@/core/systems/vtm5/rules/derived-stats'
import type { DisciplineRollEffectResult } from '@/core/systems/vtm5/rules/disciplines/effects'
import type { DamageSeverity, HealthDamageOptions } from '@/core/systems/vtm5/rules/health'
import { tableDisciplines, tableHealth, tableHumanity } from '../system-runtime'
import { getActivePenaltyDelta } from '../utils/roll-utils'
import { getAttributeDots, resolveSkillValue } from '@/lib/i18n/ruleNames'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { ATTRIBUTE_GROUPS, INVENTORY_CATEGORIES, SKILL_GROUPS, type InventoryCategory } from '../constants/roll-traits'
import type {
  CharacterHumanity,
  CharacterOption,
  InventoryItem,
  NormalizedHealth,
  NormalizedWillpower,
  RollMeta,
  RollMode,
} from '../types'

function getSelectedPowerNames(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map(power => {
      if (typeof power === 'string') return power
      if (!power || typeof power !== 'object') return ''
      const record = power as Record<string, unknown>
      return String(record.name || record['название'] || '')
    })
    .filter(Boolean)
}

function getSelectedPathPowerNames(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([pathName, powers]) => {
      const names = getSelectedPowerNames(powers)
      return names.length ? [[pathName, names]] : []
    }),
  ) as Record<string, string[]>
}

function getSelectedPathPowerLabels(value: unknown) {
  return Object.entries(getSelectedPathPowerNames(value))
    .flatMap(([pathName, powers]) => powers.map(power => `${pathName} / ${power}`))
}

function getPathPowerNameSet(value: unknown) {
  return new Set(
    Object.values(getSelectedPathPowerNames(value)).flat(),
  )
}

function getStandaloneSelectedPowerNames(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  const pathPowerNames = getPathPowerNameSet(selectedPathPowers)
  return getSelectedPowerNames(selectedPowers)
    .filter(name => !pathPowerNames.has(name))
}

function getSelectedDisciplinePowerLabels(
  selectedPowers: unknown,
  selectedPathPowers: unknown,
) {
  return [
    ...getStandaloneSelectedPowerNames(selectedPowers, selectedPathPowers),
    ...getSelectedPathPowerLabels(selectedPathPowers),
  ]
}

function getActiveEffectTitle(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  return activeEffect.effect.label
    || activeEffect.source.power
    || activeEffect.effect.type
}

function getPayloadValueLabel(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const payloadLabels: Record<string, string> = {
    commandText: 'команда',
    memoryGap: 'провал',
    falseMemory: 'ложная память',
    triggerText: 'триггер',
    groupTarget: 'группа',
    disguiseText: 'маскировка',
    objectText: 'объект',
    senseTarget: 'цель',
    questionText: 'вопрос',
    telepathyMessage: 'мысль',
    possessionTarget: 'носитель',
    areaText: 'место',
    famulusName: 'фамулус',
    animalSpecies: 'вид',
    animalCommand: 'приказ',
    swarmTarget: 'цель роя',
    frenzyTarget: 'цель ярости',
    feedingSource: 'питание',
    targetName: 'цель',
    bloodSample: 'образец крови',
    weaponName: 'оружие',
    deliveryMethod: 'способ',
    ritualTarget: 'цель ритуала',
    ritualComponents: 'компоненты',
    alchemyMethod: 'метод',
    alchemyFormula: 'формула',
    formulaTarget: 'цель формулы',
    alchemyResonance: 'резонанс',
    alchemyIngredients: 'ингредиенты',
    imitatedDiscipline: 'дисциплина',
    imitatedPower: 'сила',
  }
  const label = payloadLabels[key] || key
  return `${label}: ${String(value)}`
}

function getActiveEffectPayloadDescription(
  activeEffect: CharacterOption['activeEffects'][number],
) {
  const payload = activeEffect.effect.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ''
  }

  return Object.entries(payload)
    .map(([key, value]) => getPayloadValueLabel(key, value))
    .filter(Boolean)
    .join(' · ')
}

function getActiveEffectDescription(
  activeEffect: CharacterOption['activeEffects'][number],
  t: (ru: string) => string,
  tf: (ru: string, vars: Record<string, string | number>) => string,
) {
  return [
    activeEffect.effect.description,
    getActiveEffectPayloadDescription(activeEffect),
    activeEffect.source.path,
    activeEffect.source.level
      ? tf('уровень {level}', { level: activeEffect.source.level })
      : '',
    tableDisciplines().getDisciplineDurationLabel(activeEffect.duration, t, tf),
  ].filter(Boolean).join(' · ')
}

function getDotDisplay(value: number) {
  const dots = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)))
  return `${'●'.repeat(dots)}${'○'.repeat(5 - dots)}`
}

function getSkillDots(value: unknown) {
  if (typeof value === 'number') return value
  if (!value || typeof value !== 'object') return 0
  return Number((value as { dots?: number }).dots || 0)
}

function getSkillSpecs(value: unknown) {
  if (!value || typeof value !== 'object') return []
  const specs = (value as { specs?: unknown }).specs
  return Array.isArray(specs) ? specs.filter((spec): spec is string => typeof spec === 'string') : []
}

function getDisciplineDots(sources: Record<string, number>) {
  return Object.values(sources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
}

type ContestedOpponentOption = {
  id: string
  label: string
}

export type CharacterPreviewModalState = {
  tab: 'mechanics' | 'inventory'
  roll: {
    attribute: string
    attributeTwo: string
    skill: string
    discipline: string
    modifier: number
    mode: RollMode
    contestedOpponentId: string
    useBloodSurge: boolean
  }
  inventory: {
    name: string
    category: InventoryCategory
    quantity: number
    status: string
    isBusy: boolean
  }
}

export type CharacterPreviewModalComputed = {
  usesVampireResources: boolean
  hunger: number
  health: NormalizedHealth
  willpower: NormalizedWillpower
  humanity: CharacterHumanity
  bloodPotency: number
  sheetFixed: boolean
  damageProfile: NonNullable<CharacterOption['damageProfile']>
  healthDerived?: CharacterDerivedStats['health']
  willpowerDerived?: CharacterDerivedStats['willpower']
  canRoll: boolean
  canEditInventory: boolean
  canEditActiveEffects: boolean
  extraAttributes: string[]
  extraSkills: string[]
  disciplineNames: string[]
  diceCount: number
  poolBeforeLimit: number
  bloodSurgeBonus: number
  bloodSurgeEnabled: boolean
  rollEffectResult: DisciplineRollEffectResult | null
  contestedOpponentOptions: ContestedOpponentOption[]
  selectedContestedOpponent: ContestedOpponentOption | null
  willpowerRecoveryPool: number
  playerLabel: string
}

export type CharacterPreviewModalActions = {
  onTabChange: (tab: 'mechanics' | 'inventory') => void
  onClose: () => void
  setRollAttribute: (value: string) => void
  setRollAttributeTwo: (value: string) => void
  setRollSkill: (value: string) => void
  setRollDiscipline: (value: string) => void
  setRollModifier: (value: number) => void
  setRollMode: (mode: RollMode) => void
  setContestedOpponentId: (id: string) => void
  setUseBloodSurge: (enabled: boolean) => void
  toggleRollAttribute: (name: string) => void
  rollPool: () => void
  rollQuickDice: (count: number, label: string) => void
  openDiscipline: (name: string) => void
  rollRouseCheck: () => void
  quenchHunger: (amount: number) => void
  addHumanityStains: (amount: number) => void
  performRemorseCheck: () => void
  applyHealthDamage: (amount: number, severity: DamageSeverity, options?: HealthDamageOptions) => void
  promptHealthDamage: () => void
  recoverHealth: (
    amount: number,
    severity: DamageSeverity,
    reason: string,
    source: NonNullable<RollMeta['healing']>['type'],
  ) => void
  mendSuperficial: () => void
  mendAggravated: () => void
  recoverMortalHealth: () => void
  treatMortalHealth: () => void
  clearHealth: () => void
  markTorporOrComa: () => void
  spendWillpower: (amount: number, reason: string) => void
  rollWillpowerCheck: () => void
  recoverWillpower: (amount: number, severity: 'superficial' | 'aggravated', reason: string) => void
  confirmRecoverAggravatedWillpower: () => void
  adjustWillpowerStress: (severity: 'superficial' | 'aggravated', delta: number) => void
  removeActiveEffect: (effectId: string) => void
  setQuickInventoryName: (value: string) => void
  setQuickInventoryCategory: (value: InventoryCategory) => void
  setQuickInventoryQuantity: (value: number) => void
  addQuickInventoryItem: (event: FormEvent<HTMLFormElement>) => void
  showInventoryItemToMaster: (item: InventoryItem) => void
  onAddExperience?: () => void
  renderRollModifierControls: (result: DisciplineRollEffectResult | null | undefined) => ReactNode
}

export type CharacterPreviewModalProps = {
  character: CharacterOption
  state: CharacterPreviewModalState
  computed: CharacterPreviewModalComputed
  actions: CharacterPreviewModalActions
  isMaster: boolean
  isActiveCharacter: boolean
  characterSheetHref: string
}

export function CharacterPreviewModal({
  character,
  state,
  computed,
  actions,
  isMaster,
  isActiveCharacter,
  characterSheetHref,
}: CharacterPreviewModalProps) {
  const { t, tf } = useLang()
  const d10 = (n: number) => tf('{n}к10', { n })
  const { tab, roll, inventory } = state
  const {
    usesVampireResources,
    hunger,
    health,
    willpower,
    humanity,
    bloodPotency,
    sheetFixed,
    damageProfile,
    healthDerived,
    willpowerDerived,
    canRoll,
    canEditInventory,
    canEditActiveEffects,
    extraAttributes,
    extraSkills,
    disciplineNames,
    diceCount,
    poolBeforeLimit,
    bloodSurgeBonus,
    bloodSurgeEnabled,
    rollEffectResult,
    contestedOpponentOptions,
    selectedContestedOpponent,
    willpowerRecoveryPool,
    playerLabel,
  } = computed
  const superficialMendAmount = tableHealth().getSuperficialMendAmount(bloodPotency)

  return (
    <div className="media-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('Быстрый просмотр персонажа')} onMouseDown={actions.onClose}>
      <section className="character-preview-modal" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div className="character-preview-identity">
            <div className="chat-avatar large" aria-hidden="true">
              {character.image ? <img src={character.image} alt="" /> : <span>{character.name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div>
              <span>{playerLabel}</span>
              <strong>{character.name}</strong>
              <small>{character.clan || t('Клан не указан')}</small>
            </div>
          </div>
          <button type="button" onClick={actions.onClose} aria-label={t('Закрыть предпросмотр')}>×</button>
        </header>
        <nav className="character-preview-tabs" aria-label={t('Разделы краткого листа')}>
          <button
            type="button"
            className={tab === 'mechanics' ? 'active' : ''}
            onClick={() => actions.onTabChange('mechanics')}
          >
            {t('Броски / механика')}
          </button>
          <button
            type="button"
            className={tab === 'inventory' ? 'active' : ''}
            onClick={() => actions.onTabChange('inventory')}
          >
            {t('Инвентарь')} <span>{character.inventory.length}</span>
          </button>
        </nav>
        <div className="character-preview-body">
          <dl className="character-preview-summary">
            <div><dt>{t('Клан')}</dt><dd>{character.clan || '—'}</dd></div>
            <div><dt>{t('Поколение')}</dt><dd>{character.generation || '—'}</dd></div>
            <div><dt>{t('Тип')}</dt><dd>{character.type || '—'}</dd></div>
            <div><dt>{t('Стиль охоты')}</dt><dd>{character.predator || '—'}</dd></div>
            {usesVampireResources ? <div><dt>{t('Голод')}</dt><dd>{hunger} / 5</dd></div> : null}
            <div><dt>{t('Здоровье')}</dt><dd>{health.current} / {health.max}</dd></div>
            <div><dt>{t('Воля')}</dt><dd>{willpower.current} / {willpower.max}</dd></div>
            {usesVampireResources ? <div><dt>{t('Человечность')}</dt><dd>{tf('{value} · Сомнения {stains}', { value: humanity.value, stains: humanity.stains })}</dd></div> : null}
            {usesVampireResources ? <div><dt>{t('Сила Крови')}</dt><dd>{bloodPotency}</dd></div> : null}
            <div><dt>{t('Свободный опыт')}</dt><dd>{character.freeExp ?? 0}</dd></div>
          </dl>

          {tab === 'mechanics' ? (
            <div className="character-mechanics-sheet">
              {sheetFixed ? (
                <>
                {usesVampireResources ? <section className="preview-blood-panel">
                <div className="preview-section-heading">
                  <div>
                    <span>{t('Голод и кровь')}</span>
                    <h3>{t('Состояние')}</h3>
                  </div>
                  <strong>{hunger} / 5</strong>
                </div>
                <div className="preview-blood-grid">
                  <div>
                    <span>{t('Голод')}</span>
                    <b>{'●'.repeat(hunger)}{'○'.repeat(5 - hunger)}</b>
                  </div>
                  <div>
                    <span>{t('Сила Крови')}</span>
                    <b>{bloodPotency}</b>
                  </div>
                </div>
                {sheetFixed && usesVampireResources ? (
                  <div className="preview-blood-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="button" onClick={actions.rollRouseCheck} disabled={!canRoll}>
                      {t('Проверить Голод')}
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.quenchHunger(1)}
                      disabled={!canRoll || hunger <= 0}
                    >
                      {t('Утолить голод')}
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.quenchHunger(5)}
                      disabled={!canRoll || hunger <= 0}
                    >
                      {t('Насытиться')}
                    </button>
                  </div>
                ) : null}
                </section> : null}
              {usesVampireResources ? (
                <section className="preview-humanity-panel">
                  <div className="preview-section-heading">
                    <div>
                      <span>{t('Человечность')}</span>
                      <h3>{t('Сомнения и муки совести')}</h3>
                    </div>
                    <strong>{humanity.value} / 10</strong>
                  </div>
                  <div className="preview-humanity-track" aria-label={tf('Человечность {value}, Сомнения {stains}', { value: humanity.value, stains: humanity.stains })}>
                    {Array.from({ length: 10 }, (_, index) => {
                      const cell = index + 1
                      const status = cell <= humanity.value
                        ? 'humanity-filled'
                        : cell <= humanity.value + humanity.stains
                          ? 'stain'
                          : 'empty'
                      return <span className={`preview-humanity-cell ${status}`} key={`preview-humanity-${cell}`} />
                    })}
                  </div>
                  <p className="preview-humanity-caption">
                    {tf('Сомнения {stains} / {remaining} · свободно {free}', { stains: humanity.stains, remaining: 10 - humanity.value, free: humanity.freeBoxes })}
                  </p>
                  {humanity.status === 'at_risk' ? (
                    <p className="preview-roll-notice warning">{t('Шкала Сомнений заполнена. Следующая проверка почти наверняка приведёт к потере Человечности.')}</p>
                  ) : null}
                  {humanity.status === 'lost_to_beast' ? (
                    <p className="preview-roll-notice danger">{t('Человечность 0: персонаж окончательно уступает Зверю и переходит под контроль Рассказчика.')}</p>
                  ) : null}
                  {sheetFixed ? (
                    <div className="preview-humanity-actions">
                      <button type="button" onClick={() => actions.addHumanityStains(1)} disabled={!canRoll}>
                        + {t('Сомнение')}
                      </button>
                      <button
                        type="button"
                        onClick={actions.performRemorseCheck}
                        disabled={!canRoll || humanity.stains <= 0}
                        title={humanity.stains <= 0 ? t('Нет Сомнений для проверки.') : tf('Пул: {dice}к10', { dice: tableHumanity().getRemorseDice(humanity) })}
                      >
                        {t('Проверка мук совести')}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              <section className="preview-willpower-panel">
                <div className="preview-section-heading">
                  <div>
                    <span>{t('Здоровье')}</span>
                    <h3>{t('Повреждения')}</h3>
                  </div>
                  <strong>{health.current} / {health.max}</strong>
                </div>
                {healthDerived ? (
                  <p className="preview-humanity-caption">
                    {t('Здоровье')}: {healthDerived.baseMax}
                    {healthDerived.legacyBonus > 0 ? ` + ${healthDerived.legacyBonus}` : ''}
                    {healthDerived.passiveBonus > 0
                      ? ` + ${healthDerived.passiveBonus} ${t('от Стойкости')}`
                      : ''}
                    {' = '}{healthDerived.totalMax}
                  </p>
                ) : null}
                <div className="preview-willpower-track" aria-label={t('Трек Здоровья')}>
                  {Array.from({ length: health.max }, (_, index) => {
                    const cell = index + 1
                    const status = cell <= health.aggravated
                      ? 'aggravated'
                      : cell <= health.aggravated + health.superficial
                        ? 'superficial'
                        : 'empty'
                    return (
                      <span className={`preview-willpower-cell ${status}`} key={`preview-health-${cell}`}>
                        {status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                      </span>
                    )
                  })}
                </div>
                {health.impaired ? <p className="preview-roll-notice">{tableHealth().getHealthWarning(health, damageProfile, t)}</p> : null}
                {sheetFixed ? <div className="preview-willpower-actions preview-health-actions">
                  <button type="button" onClick={() => actions.applyHealthDamage(1, 'superficial', { source: 'manual', ignoreHalving: true })} disabled={!canRoll}>+ {t('лёгкий')}</button>
                  <button type="button" onClick={() => actions.applyHealthDamage(1, 'aggravated', { source: 'manual' })} disabled={!canRoll}>+ {t('тяжёлый')}</button>
                  <button type="button" onClick={actions.promptHealthDamage} disabled={!canRoll}>{t('+N урона')}</button>
                  <button type="button" onClick={() => actions.recoverHealth(1, 'superficial', 'Ручное лечение', 'manual')} disabled={!canRoll || health.superficial < 1}>- {t('лёгкий')}</button>
                  <button type="button" onClick={() => actions.recoverHealth(1, 'aggravated', 'Ручное лечение', 'manual')} disabled={!canRoll || health.aggravated < 1}>- {t('тяжёлый')}</button>
                  <button type="button" onClick={actions.mendSuperficial} disabled={!canRoll || health.superficial < 1 || !['vampire', 'thinblood'].includes(damageProfile)}>
                    {t('Заживить лёгкий')}
                  </button>
                  <button type="button" onClick={actions.mendAggravated} disabled={!canRoll || health.aggravated < 1 || !['vampire', 'thinblood'].includes(damageProfile)}>
                    {t('Заживить тяжёлый')}
                  </button>
                  <button type="button" onClick={actions.recoverMortalHealth} disabled={!canRoll || health.superficial < 1 || !['mortal', 'ghoul', 'custom'].includes(damageProfile)}>
                    {t('Восстановление смертного')}
                  </button>
                  <button type="button" onClick={actions.treatMortalHealth} disabled={!canRoll || health.aggravated < 1 || !['mortal', 'ghoul', 'custom'].includes(damageProfile)}>
                    {t('Лечение смертного')}
                  </button>
                  <button
                    type="button"
                    onClick={actions.clearHealth}
                    disabled={!canRoll || (!health.superficial && !health.aggravated)}
                  >
                    {t('Очистить')}
                  </button>
                  <button
                    type="button"
                    onClick={actions.markTorporOrComa}
                    disabled={!canRoll}
                  >
                    {t('Торпор/кома')}
                  </button>
                </div> : null}
                {damageProfile === 'thinblood' ? <p className="preview-roll-notice">{t('Слабокровные получают часть урона ближе к смертным.')}</p> : null}
                {usesVampireResources ? <p className="preview-roll-notice">{tf('Сила Крови {potency}: за Испытание Крови лечит {amount} лёгк.', { potency: bloodPotency, amount: superficialMendAmount })}</p> : null}
              </section>
              <section className="preview-willpower-panel">
                <div className="preview-section-heading">
                  <div>
                    <span>{t('Воля')}</span>
                    <h3>{t('Стресс')}</h3>
                  </div>
                  <strong>{willpower.current} / {willpower.max}</strong>
                </div>
                {willpowerDerived ? (
                  <p className="preview-humanity-caption">
                    {t('Воля')}: {willpowerDerived.baseMax}
                    {willpowerDerived.legacyBonus > 0 ? ` + ${willpowerDerived.legacyBonus}` : ''}
                    {willpowerDerived.passiveBonus > 0
                      ? ` + ${willpowerDerived.passiveBonus} ${t('от дисциплин')}`
                      : ''}
                    {' = '}{willpowerDerived.totalMax}
                  </p>
                ) : null}
                <div className="preview-willpower-track" aria-label={t('Трек Воли')}>
                  {Array.from({ length: willpower.max }, (_, index) => {
                    const cell = index + 1
                    const status = cell <= willpower.aggravated
                      ? 'aggravated'
                      : cell <= willpower.aggravated + willpower.superficial
                        ? 'superficial'
                        : 'empty'
                    return (
                      <span className={`preview-willpower-cell ${status}`} key={`preview-wp-${cell}`}>
                        {status === 'aggravated' ? 'X' : status === 'superficial' ? '/' : ''}
                      </span>
                    )
                  })}
                </div>
                {willpower.impaired ? <p className="preview-roll-notice">{t('Трек заполнен: ментальные и социальные проверки получают -2к10.')}</p> : null}
                {sheetFixed ? <div className="preview-willpower-actions">
                  <button type="button" onClick={() => actions.spendWillpower(1, 'Воля: трата')} disabled={!canRoll || willpower.aggravated >= willpower.max}>
                    {t('Потратить')}
                  </button>
                  <button type="button" onClick={actions.rollWillpowerCheck} disabled={!canRoll || willpower.current < 1}>
                    {t('Проверка Воли')}
                  </button>
                  <button type="button" onClick={() => actions.recoverWillpower(willpowerRecoveryPool, 'superficial', 'Воля: начало встречи')} disabled={!canRoll || willpower.superficial < 1}>
                    {t('Встреча')}
                  </button>
                  <button type="button" onClick={() => actions.recoverWillpower(1, 'superficial', 'Воля: Прихоть')} disabled={!canRoll || willpower.superficial < 1}>
                    {t('Прихоть +1')}
                  </button>
                  <button
                    type="button"
                    onClick={actions.confirmRecoverAggravatedWillpower}
                    disabled={!canRoll || willpower.aggravated < 1}
                  >
                    {t('Снять X')}
                  </button>
                  <button type="button" onClick={() => actions.adjustWillpowerStress('superficial', 1)} disabled={!canRoll}>+ /</button>
                  <button type="button" onClick={() => actions.adjustWillpowerStress('superficial', -1)} disabled={!canRoll}>- /</button>
                  <button type="button" onClick={() => actions.adjustWillpowerStress('aggravated', 1)} disabled={!canRoll}>+ X</button>
                  <button type="button" onClick={() => actions.adjustWillpowerStress('aggravated', -1)} disabled={!canRoll}>- X</button>
                </div> : null}
              </section>
              <section className="preview-willpower-panel">
                <div className="preview-section-heading">
                  <div>
                    <span>{t('Состояние персонажа')}</span>
                    <h3>{t('Активные эффекты')}</h3>
                  </div>
                  <strong>{character.activeEffects.length}</strong>
                </div>
                {character.activeEffects.length === 0 ? (
                  <p className="character-preview-empty">{t('Активных эффектов нет.')}</p>
                ) : (
                  <div className="preview-inventory-list">
                    {character.activeEffects.map(activeEffect => (
                      <article key={activeEffect.id}>
                        <header>
                          <div>
                            <strong>{getActiveEffectTitle(activeEffect)}</strong>
                            <span>{activeEffect.source.discipline || t('Ручной эффект')}</span>
                          </div>
                          <b>{activeEffect.active ? t('активен') : t('выкл.')}</b>
                        </header>
                        {getActiveEffectDescription(activeEffect, t, tf) ? (
                          <p>{getActiveEffectDescription(activeEffect, t, tf)}</p>
                        ) : null}
                        <footer>
                          <button
                            type="button"
                            onClick={() => actions.removeActiveEffect(activeEffect.id)}
                            disabled={!canEditActiveEffects}
                          >
                            {t('Отключить')}
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                )}
                <p className="preview-roll-notice">{t('Активные roll modifiers применяются к броскам; урон пока не автоматизируется.')}</p>
              </section>
                </>
              ) : (
                <section className="preview-creation-vitals">
                  <div>
                    <span>{t('Лист ещё не зафиксирован')}</span>
                    <strong>{t('Стартовые значения')}</strong>
                  </div>
                  <dl>
                    <div><dt>{t('Здоровье')}</dt><dd>{health.max}</dd></div>
                    <div><dt>{t('Воля')}</dt><dd>{willpower.max}</dd></div>
                    {usesVampireResources ? <div><dt>{t('Человечность')}</dt><dd>{humanity.value}</dd></div> : null}
                    {usesVampireResources ? <div><dt>{t('Голод')}</dt><dd>{hunger}</dd></div> : null}
                    {usesVampireResources ? <div><dt>{t('Сила Крови')}</dt><dd>{bloodPotency}</dd></div> : null}
                  </dl>
                </section>
              )}
              <section className="preview-roll-builder">
                <div className="preview-section-heading">
                  <div>
                    <span>{t('Пул костей')}</span>
                    <h3>{t('Собрать бросок')}</h3>
                  </div>
                  <strong>{d10(diceCount)}</strong>
                </div>
                <div className="preview-roll-controls">
                  <label>
                    <span>{t('Характеристика 1')}</span>
                    <select value={roll.attribute} onChange={event => actions.setRollAttribute(event.target.value)}>
                      <option value="">{t('Без характеристики')}</option>
                      {ATTRIBUTE_GROUPS.map(group => (
                        <optgroup key={group.name} label={t(group.name)}>
                          {group.traits.map(name => <option key={name} value={name} disabled={roll.attributeTwo === name}>{t(name)} · {getAttributeDots(character.attributes, name)}</option>)}
                        </optgroup>
                      ))}
                      {extraAttributes.length ? (
                        <optgroup label={t('Другие')}>
                          {extraAttributes.map(name => <option key={name} value={name} disabled={roll.attributeTwo === name}>{name} · {getAttributeDots(character.attributes, name)}</option>)}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  <label>
                    <span>{t('Характеристика 2')}</span>
                    <select value={roll.attributeTwo} onChange={event => actions.setRollAttributeTwo(event.target.value)}>
                      <option value="">{t('Без второй характеристики')}</option>
                      {ATTRIBUTE_GROUPS.map(group => (
                        <optgroup key={group.name} label={t(group.name)}>
                          {group.traits.map(name => <option key={name} value={name} disabled={roll.attribute === name}>{t(name)} · {getAttributeDots(character.attributes, name)}</option>)}
                        </optgroup>
                      ))}
                      {extraAttributes.length ? (
                        <optgroup label={t('Другие')}>
                          {extraAttributes.map(name => <option key={name} value={name} disabled={roll.attribute === name}>{name} · {getAttributeDots(character.attributes, name)}</option>)}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  <label>
                    <span>{t('Навык')}</span>
                    <select value={roll.skill} onChange={event => actions.setRollSkill(event.target.value)}>
                      <option value="">{t('Без навыка')}</option>
                      {SKILL_GROUPS.map(group => (
                        <optgroup key={group.name} label={t(group.name)}>
                          {group.traits.map(name => <option key={name} value={name}>{t(name)} · {getSkillDots(resolveSkillValue(character.skills, name))}</option>)}
                        </optgroup>
                      ))}
                      {extraSkills.length ? (
                        <optgroup label={t('Другие')}>
                          {extraSkills.map(name => <option key={name} value={name}>{name} · {getSkillDots(resolveSkillValue(character.skills, name))}</option>)}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  <label>
                    <span>{t('Дисциплина')}</span>
                    <select value={roll.discipline} onChange={event => actions.setRollDiscipline(event.target.value)}>
                      <option value="">{t('Без дисциплины')}</option>
                      {disciplineNames.map(name => (
                        <option key={name} value={name}>{name} · {getDisciplineDots(character.disciplines[name] || {})}</option>
                      ))}
                    </select>
                  </label>
                  <label className="preview-modifier-field">
                    <span>{t('Модификатор')}</span>
                    <input
                      type="number"
                      min="-20"
                      max="20"
                      value={roll.modifier}
                      onChange={event => actions.setRollModifier(Math.max(-20, Math.min(20, Number(event.target.value) || 0)))}
                    />
                  </label>
                  {usesVampireResources ? <label className="preview-blood-surge-toggle">
                    <span>{tf('Прилив Крови +{bonus}к10', { bonus: bloodSurgeBonus })}</span>
                    <input
                      type="checkbox"
                      checked={bloodSurgeEnabled}
                      onChange={event => actions.setUseBloodSurge(event.target.checked)}
                    />
                  </label> : null}
                  <label className="roll-mode-field">
                    <span>{t('Тип броска')}</span>
                    <select
                      value={roll.mode}
                      onChange={event => {
                        const nextMode = event.target.value as RollMode
                        actions.setRollMode(nextMode)
                        if (nextMode === 'normal') actions.setContestedOpponentId('')
                      }}
                    >
                      <option value="normal">{t('Обычный бросок')}</option>
                      <option value="contested">{t('Встречный бросок')}</option>
                    </select>
                  </label>
                  {roll.mode === 'contested' ? (
                    <label className="contested-opponent-field">
                      <span>{t('Оппонент')}</span>
                      <select
                        value={roll.contestedOpponentId}
                        onChange={event => actions.setContestedOpponentId(event.target.value)}
                        disabled={contestedOpponentOptions.length === 0}
                      >
                        <option value="">{contestedOpponentOptions.length ? t('Выбрать оппонента') : t('Нет доступных оппонентов')}</option>
                        {contestedOpponentOptions.map(option => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="preview-roll-submit"
                    onClick={actions.rollPool}
                    disabled={!canRoll || diceCount < 1 || (roll.mode === 'contested' && !selectedContestedOpponent)}
                  >
                    {roll.mode === 'contested' ? t('Запросить встречный') : t('Бросить')} {Math.min(20, diceCount + (bloodSurgeEnabled ? bloodSurgeBonus : 0)) || 0}к10
                  </button>
                </div>
                {actions.renderRollModifierControls(rollEffectResult)}
                <div className="quick-roll-grid" aria-label={t('Быстрые броски')}>
                  {[1, 3, 5, 7].map(count => (
                    <button
                      type="button"
                      key={count}
                      disabled={!canRoll}
                      onClick={() => actions.rollQuickDice(count, d10(count))}
                    >
                      {d10(count)}
                    </button>
                  ))}
                </div>
                {!canRoll ? <p className="preview-roll-notice">{t('Бросать может мастер или владелец активного персонажа.')}</p> : null}
                {poolBeforeLimit > 20 ? <p className="preview-roll-notice">{t('Пул ограничен двадцатью костями.')}</p> : null}
                {getActivePenaltyDelta(rollEffectResult, 'willpower_impairment') ? <p className="preview-roll-notice">{t('Истощение Воли: -2к10 к этому пулу.')}</p> : null}
                {getActivePenaltyDelta(rollEffectResult, 'health_impairment') ? <p className="preview-roll-notice">{t('Изнурение по здоровью: -2к10 к этому пулу.')}</p> : null}
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading"><h3>{t('Характеристики')}</h3><span>{t('Можно выбрать две характеристики')}</span></div>
                <div className="preview-trait-columns">
                  {ATTRIBUTE_GROUPS.map(group => (
                    <div className="preview-trait-group" key={group.name}>
                      <h4>{t(group.name)}</h4>
                      {group.traits.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        return (
                          <button
                            type="button"
                            key={name}
                            className={roll.attribute === name || roll.attributeTwo === name ? 'active' : ''}
                            onClick={() => actions.toggleRollAttribute(name)}
                          >
                            <span>{t(name)}</span><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  {extraAttributes.length ? (
                    <div className="preview-trait-group">
                      <h4>{t('Другие')}</h4>
                      {extraAttributes.map(name => {
                        const dots = getAttributeDots(character.attributes, name)
                        return (
                          <button type="button" key={name} className={roll.attribute === name || roll.attributeTwo === name ? 'active' : ''} onClick={() => actions.toggleRollAttribute(name)}>
                            <span>{name}</span><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading"><h3>{t('Навыки')}</h3><span>{t('Специализации указаны под навыком')}</span></div>
                <div className="preview-trait-columns skills">
                  {SKILL_GROUPS.map(group => (
                    <div className="preview-trait-group" key={group.name}>
                      <h4>{t(group.name)}</h4>
                      {group.traits.map(name => {
                        const value = resolveSkillValue(character.skills, name)
                        const dots = getSkillDots(value)
                        const specs = getSkillSpecs(value)
                        return (
                          <button
                            type="button"
                            key={name}
                            className={roll.skill === name ? 'active' : ''}
                            onClick={() => actions.setRollSkill(roll.skill === name ? '' : name)}
                          >
                            <span>{t(name)}{specs.length ? <small>{specs.join(', ')}</small> : null}</span>
                            <i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  {extraSkills.length ? (
                    <div className="preview-trait-group">
                      <h4>{t('Другие')}</h4>
                      {extraSkills.map(name => {
                        const value = resolveSkillValue(character.skills, name)
                        const dots = getSkillDots(value)
                        const specs = getSkillSpecs(value)
                        return (
                          <button type="button" key={name} className={roll.skill === name ? 'active' : ''} onClick={() => actions.setRollSkill(roll.skill === name ? '' : name)}>
                            <span>{name}{specs.length ? <small>{specs.join(', ')}</small> : null}</span>
                            <i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="preview-trait-section">
                <div className="preview-section-heading"><h3>{t('Дисциплины и способности')}</h3><span>{t('Нажми дисциплину, чтобы открыть силы')}</span></div>
                {disciplineNames.length === 0 ? (
                  <p className="character-preview-empty">{t('Дисциплины не сохранены.')}</p>
                ) : (
                  <div className="preview-discipline-list">
                    {disciplineNames.map(name => {
                      const dots = getDisciplineDots(character.disciplines[name] || {})
                      const powerLabels = getSelectedDisciplinePowerLabels(
                        character.selectedPowers[name],
                        character.selectedPathPowers[name],
                      )
                      return (
                        <button type="button" className="preview-discipline-card" key={name} onClick={() => actions.openDiscipline(name)}>
                          <span><strong>{name}</strong><i aria-label={tf('{dots} из 5', { dots })}>{getDotDisplay(dots)}</i></span>
                          {powerLabels.length ? <p>{powerLabels.join(' · ')}</p> : <p>{t('Открыть описание и доступные силы')}</p>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="character-inventory-sheet">
              <div className="preview-section-heading">
                <div><span>{t('Снаряжение персонажа')}</span><h3>{t('Инвентарь')}</h3></div>
                <strong>{character.inventory.length}</strong>
              </div>
              {canEditInventory ? (
                <form className="quick-inventory-form" onSubmit={actions.addQuickInventoryItem}>
                  <label className="quick-inventory-name">
                    <span>{t('Новый предмет')}</span>
                    <input
                      value={inventory.name}
                      onChange={event => actions.setQuickInventoryName(event.target.value)}
                      placeholder={t('Название')}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    <span>{t('Категория')}</span>
                    <select value={inventory.category} onChange={event => actions.setQuickInventoryCategory(event.target.value as InventoryCategory)}>
                      {INVENTORY_CATEGORIES.map(category => <option value={category} key={category}>{t(category)}</option>)}
                    </select>
                  </label>
                  <label className="quick-inventory-quantity">
                    <span>{t('Количество')}</span>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={inventory.quantity}
                      onChange={event => actions.setQuickInventoryQuantity(Math.max(0, Math.min(999, Number(event.target.value) || 0)))}
                    />
                  </label>
                  <button type="submit" disabled={!inventory.name.trim() || inventory.isBusy}>
                    {inventory.isBusy ? t('Сохраняю...') : t('Добавить')}
                  </button>
                </form>
              ) : (
                <p className="quick-inventory-readonly">{t('Добавлять предметы может владелец активного персонажа.')}</p>
              )}
              {inventory.status ? <p className="quick-inventory-status" role="status">{t(inventory.status)}</p> : null}
              {character.inventory.length === 0 ? (
                <p className="character-preview-empty">{t('Инвентарь пуст.')}</p>
              ) : (
                <div className="preview-inventory-list">
                  {character.inventory.map(item => (
                    <article key={item.id}>
                      <header>
                        <div><strong>{item.name || t('Без названия')}</strong><span>{t(item.category) || t('Без категории')}</span></div>
                        <b aria-label={tf('Количество: {quantity}', { quantity: item.quantity ?? 1 })}>×{item.quantity ?? 1}</b>
                      </header>
                      {item.description ? <p>{item.description}</p> : null}
                      {item.note ? <aside><span>{t('Заметка')}</span>{item.note}</aside> : null}
                      {canEditInventory && !isMaster ? (
                        <footer>
                          <button type="button" onClick={() => actions.showInventoryItemToMaster(item)}>{t('Показать мастеру')}</button>
                        </footer>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="character-preview-actions">
          <button type="button" className="secondary-left" onClick={actions.onClose}>{t('Закрыть')}</button>
          {character.id && isActiveCharacter ? (
            <button type="button" onClick={actions.onAddExperience}>{t('Добавить опыт')}</button>
          ) : null}
          <a href={characterSheetHref}>{t('Открыть полный лист')}</a>
        </footer>
      </section>
    </div>
  )
}
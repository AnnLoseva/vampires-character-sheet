'use client'

import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_MASTER_MODULE_ID,
  getMasterContribution,
  MASTER_CONSOLE_CONTRIBUTIONS,
} from '../contributions'
import type { MasterModuleProps, MasterRollRequest } from '../types'

type MasterModuleHostProps = {
  room: string
  activeModuleId: string
  onRequestRoll?: (request: MasterRollRequest) => void
}

type ErrorBoundaryState = { error: string | null }

class ModuleErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error.message : 'Ошибка модуля' }
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="master-module-empty">
          <span>Ошибка модуля</span>
          <h1>Не удалось отрисовать окно</h1>
          <p>{this.state.error}</p>
        </section>
      )
    }
    return this.props.children
  }
}

function readDeepLinkParams(contributionDeepLinks: readonly string[] | undefined) {
  if (typeof window === 'undefined' || !contributionDeepLinks?.length) return {}
  const params = new URLSearchParams(window.location.search)
  const result: Record<string, string> = {}
  for (const key of contributionDeepLinks) {
    const value = params.get(key)
    if (value) result[key] = value
  }
  return result
}

export default function MasterModuleHost({
  room,
  activeModuleId,
  onRequestRoll,
}: MasterModuleHostProps) {
  const contribution = getMasterContribution(activeModuleId)
    || getMasterContribution(DEFAULT_MASTER_MODULE_ID)
    || MASTER_CONSOLE_CONTRIBUTIONS[0]

  const LazyModule = useMemo(() => {
    if (!contribution) return null
    return lazy(contribution.loader)
  }, [contribution])

  const [deepLinkParams, setDeepLinkParams] = useState<Record<string, string>>({})

  useEffect(() => {
    setDeepLinkParams(readDeepLinkParams(contribution?.deepLinks))
  }, [contribution?.deepLinks, contribution?.id])

  if (!contribution || !LazyModule) {
    return (
      <main className="master-module-host" aria-label="Рабочая область мастерского пульта">
        <section className="master-module-empty">
          <span>Рабочая область</span>
          <h1>Нет зарегистрированных модулей</h1>
          <p>Contribution registry пуст.</p>
        </section>
      </main>
    )
  }

  const moduleProps: MasterModuleProps = {
    room,
    role: 'master',
    deepLinkParams,
    onRequestRoll,
  }

  return (
    <main className="master-module-host master-module-host--filled" aria-label="Рабочая область мастерского пульта">
      <ModuleErrorBoundary resetKey={contribution.id}>
        <Suspense
          fallback={(
            <section className="master-module-empty">
              <span>{contribution.icon} {contribution.title}</span>
              <h1>Загрузка модуля…</h1>
            </section>
          )}
        >
          <LazyModule {...moduleProps} />
        </Suspense>
      </ModuleErrorBoundary>
    </main>
  )
}

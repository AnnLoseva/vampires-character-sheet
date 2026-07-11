'use client'

import { FormEvent, useEffect, useState } from 'react'
import { getRoomFromLocation, rememberRoom, verifyMasterPassword } from '@/modules/table/utils/room-session'
import { bootstrapMasterConsoleForRoom } from './bootstrap'
import MasterConsoleShell from './MasterConsoleShell'
import type { MasterConsoleRouteState } from './types'

const VALID_ROOM = /^[a-zA-Z0-9а-яА-ЯёЁ_.-]{1,48}$/

export default function MasterConsoleRoute() {
  const [state, setState] = useState<MasterConsoleRouteState>({ status: 'loading' })
  const [password, setPassword] = useState('')

  useEffect(() => {
    const roomParam = new URLSearchParams(window.location.search).get('room')?.trim() || ''
    if (!roomParam || !VALID_ROOM.test(roomParam)) {
      setState({
        status: 'invalid-room',
        message: 'Укажите корректную комнату: /master?room=campaign-666',
      })
      return
    }

    const room = getRoomFromLocation()
    try {
      rememberRoom(room)
      bootstrapMasterConsoleForRoom(room)
      setState({ status: 'locked', room, denied: false })
    } catch (error) {
      console.error('Master console bootstrap failed:', error)
      setState({ status: 'invalid-room', message: 'Не удалось открыть комнату.' })
    }
  }, [])

  const enter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (state.status !== 'locked') return
    if (!verifyMasterPassword(password)) {
      setState({ ...state, denied: true })
      return
    }
    setPassword('')
    setState({ status: 'ready', room: state.room })
  }

  if (state.status === 'loading') {
    return <MasterConsoleState title="Загрузка пульта" message="Подготавливаем комнату и VTM5 runtime…" />
  }

  if (state.status === 'invalid-room') {
    return <MasterConsoleState title="Комната не указана" message={state.message} tone="error" />
  }

  if (state.status === 'locked') {
    return (
      <div className="master-console-access vtm-theme">
        <form onSubmit={enter} aria-label="Доступ к пульту рассказчика">
          <span>Пульт рассказчика · V5</span>
          <h1>Подтвердите доступ мастера</h1>
          <p>Комната: <strong>{state.room}</strong></p>
          <label>
            <span>Пароль мастера</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              aria-invalid={state.denied}
            />
          </label>
          {state.denied ? <p className="master-console-error" role="alert">Доступ запрещён: пароль не подошёл.</p> : null}
          <button type="submit">Открыть пульт</button>
        </form>
      </div>
    )
  }

  return <MasterConsoleShell room={state.room} onLock={() => setState({ status: 'locked', room: state.room, denied: false })} />
}

function MasterConsoleState({
  title,
  message,
  tone = 'neutral',
}: {
  title: string
  message: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <main className="master-console-state vtm-theme" data-tone={tone}>
      <section>
        <span>Пульт рассказчика · V5</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </section>
    </main>
  )
}

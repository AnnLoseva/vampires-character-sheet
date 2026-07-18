'use client'

import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLang } from '@/lib/i18n/LanguageProvider'
import { TOKEN_LAYER_Z } from '@/modules/table/constants'
import type { CharacterToken, TokenPatch } from '@/modules/table/types'

const DRAG_THRESHOLD = 5
const DOUBLE_TAP_DELAY = 300
const MOVE_BROADCAST_INTERVAL = 90

type TokenDragState = {
  tokenId: string
  mode: 'move' | 'resize'
  corner?: 'nw' | 'ne' | 'sw' | 'se'
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  aspectRatio: number
  moved: boolean
  lastBroadcastAt: number
  previewX: number
  previewY: number
  previewWidth: number
  previewHeight: number
}

export type TokenLayerProps = {
  tokens: CharacterToken[]
  sceneBounds: { width: number; height: number }
  zoom: number
  isMaster: boolean
  /** Player view: foreign tokens are clipped to the stage; own tokens render unclipped. */
  clipForeign: boolean
  selectedTokenId: string | null
  setSelectedTokenId: (id: string | null) => void
  isOwnToken: (token: CharacterToken) => boolean
  canManageToken: (token: CharacterToken) => boolean
  canResizeToken: (token: CharacterToken) => boolean
  broadcastTokenMove: (updates: Array<{ id: string; x: number; y: number }>) => void
  commitTokenPosition: (tokenId: string, position: { x: number; y: number }) => Promise<void>
  patchToken: (tokenId: string, patch: TokenPatch) => Promise<void>
  bringTokenToFront: (tokenId: string) => Promise<void>
  deleteToken: (tokenId: string) => Promise<void>
  onOpenCharacter: (token: CharacterToken) => void
}

export default function TokenLayer({
  tokens,
  sceneBounds,
  zoom,
  isMaster,
  clipForeign,
  selectedTokenId,
  setSelectedTokenId,
  isOwnToken,
  canManageToken,
  canResizeToken,
  broadcastTokenMove,
  commitTokenPosition,
  patchToken,
  bringTokenToFront,
  deleteToken,
  onOpenCharacter,
}: TokenLayerProps) {
  const { t } = useLang()
  const dragRef = useRef<TokenDragState | null>(null)
  const lastTapRef = useRef<{ tokenId: string; at: number }>({ tokenId: '', at: 0 })

  const getTokenElement = (tokenId: string) =>
    document.querySelector<HTMLElement>(`.character-token[data-token-id="${CSS.escape(tokenId)}"]`)

  const startTokenPointer = (event: ReactPointerEvent<HTMLElement>, token: CharacterToken) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.stopPropagation()
    const manageable = canManageToken(token)
    setSelectedTokenId(token.id)
    if (manageable) void bringTokenToFront(token.id)
    if (!manageable) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      tokenId: token.id,
      mode: 'move',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: token.x,
      startY: token.y,
      startWidth: token.width,
      startHeight: token.height,
      aspectRatio: Math.max(0.01, token.width / token.height),
      moved: false,
      lastBroadcastAt: 0,
      previewX: token.x,
      previewY: token.y,
      previewWidth: token.width,
      previewHeight: token.height,
    }
  }

  const startTokenResize = (
    event: ReactPointerEvent<HTMLElement>,
    token: CharacterToken,
    corner: 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    if (!canResizeToken(token)) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      tokenId: token.id,
      mode: 'resize',
      corner,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: token.x,
      startY: token.y,
      startWidth: token.width,
      startHeight: token.height,
      aspectRatio: Math.max(0.01, token.width / token.height),
      moved: false,
      lastBroadcastAt: 0,
      previewX: token.x,
      previewY: token.y,
      previewWidth: token.width,
      previewHeight: token.height,
    }
  }

  const updateTokenPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dxClient = event.clientX - drag.startClientX
    const dyClient = event.clientY - drag.startClientY
    if (!drag.moved && Math.hypot(dxClient, dyClient) < DRAG_THRESHOLD) return
    drag.moved = true

    const sceneDx = dxClient / zoom
    const sceneDy = dyClient / zoom
    const element = getTokenElement(drag.tokenId)

    if (drag.mode === 'move') {
      drag.previewX = Math.round(drag.startX + sceneDx)
      drag.previewY = Math.round(drag.startY + sceneDy)
      if (element) element.style.transform = `translate3d(${sceneDx}px, ${sceneDy}px, 0)`
      const now = performance.now()
      if (now - drag.lastBroadcastAt >= MOVE_BROADCAST_INTERVAL) {
        drag.lastBroadcastAt = now
        broadcastTokenMove([{ id: drag.tokenId, x: drag.previewX, y: drag.previewY }])
      }
      return
    }

    const horizontal = drag.corner?.includes('w') ? -sceneDx : sceneDx
    const vertical = drag.corner?.includes('n') ? -sceneDy : sceneDy
    const widthFromX = drag.startWidth + horizontal
    const widthFromY = (drag.startHeight + vertical) * drag.aspectRatio
    const width = Math.max(24, Math.round(Math.abs(horizontal) > Math.abs(vertical) ? widthFromX : widthFromY))
    const height = Math.max(24, Math.round(width / drag.aspectRatio))
    drag.previewWidth = width
    drag.previewHeight = height
    drag.previewX = drag.corner?.includes('w') ? Math.round(drag.startX + drag.startWidth - width) : drag.startX
    drag.previewY = drag.corner?.includes('n') ? Math.round(drag.startY + drag.startHeight - height) : drag.startY
    if (element) {
      element.style.left = `${drag.previewX}px`
      element.style.top = `${drag.previewY}px`
      element.style.width = `${drag.previewWidth}px`
      element.style.height = `${drag.previewHeight}px`
    }
  }

  const finishTokenPointer = (event: ReactPointerEvent<HTMLElement>, token: CharacterToken) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const element = getTokenElement(drag.tokenId)

    if (drag.mode === 'move') {
      if (element) element.style.transform = ''
      if (drag.moved) {
        void commitTokenPosition(drag.tokenId, { x: drag.previewX, y: drag.previewY })
        return
      }
      // Short tap: double-tap within the delay opens the character card.
      const now = performance.now()
      const lastTap = lastTapRef.current
      lastTapRef.current = { tokenId: token.id, at: now }
      if (lastTap.tokenId === token.id && now - lastTap.at <= DOUBLE_TAP_DELAY) {
        lastTapRef.current = { tokenId: '', at: 0 }
        onOpenCharacter(token)
      }
      return
    }

    if (drag.moved) {
      void patchToken(drag.tokenId, {
        x: drag.previewX,
        y: drag.previewY,
        width: drag.previewWidth,
        height: drag.previewHeight,
      })
    }
  }

  const cancelTokenPointer = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    const element = getTokenElement(drag.tokenId)
    if (!element) return
    if (drag.mode === 'move') element.style.transform = ''
    else {
      element.style.left = `${drag.startX}px`
      element.style.top = `${drag.startY}px`
      element.style.width = `${drag.startWidth}px`
      element.style.height = `${drag.startHeight}px`
    }
  }

  const renderToken = (token: CharacterToken) => {
    const selected = selectedTokenId === token.id
    const manageable = canManageToken(token)
    const resizable = canResizeToken(token)
    return (
      <div
        key={token.id}
        className={`character-token ${selected ? 'selected' : ''} ${manageable ? 'manageable' : 'foreign'}`}
        data-token-id={token.id}
        style={{
          left: token.x,
          top: token.y,
          width: token.width,
          height: token.height,
          zIndex: token.zIndex,
        }}
        title={token.characterName || undefined}
        onPointerDown={event => startTokenPointer(event, token)}
        onPointerMove={updateTokenPointer}
        onPointerUp={event => finishTokenPointer(event, token)}
        onPointerCancel={cancelTokenPointer}
        onClick={event => event.stopPropagation()}
        onDragStart={event => event.preventDefault()}
      >
        {token.imageUrl ? (
          <img src={token.imageUrl} alt="" draggable={false} />
        ) : (
          <span className="character-token-fallback">{(token.characterName || '?').slice(0, 1).toUpperCase()}</span>
        )}
        {selected ? (
          <span className="character-token-name">{token.characterName || t('Безымянный')}</span>
        ) : null}
        {selected && manageable ? (
          <button
            type="button"
            className="character-token-remove"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation()
              void deleteToken(token.id)
            }}
            title={t('Убрать токен со стола')}
            aria-label={t('Убрать токен со стола')}
          >
            ×
          </button>
        ) : null}
        {selected && resizable ? (
          <>
            {(['nw', 'ne', 'sw', 'se'] as const).map(corner => (
              <button
                type="button"
                key={corner}
                className={`resize-handle ${corner}`}
                onPointerDown={event => startTokenResize(event, token, corner)}
                onPointerMove={updateTokenPointer}
                onPointerUp={event => finishTokenPointer(event, token)}
                onPointerCancel={cancelTokenPointer}
                title={t('Изменить размер')}
              />
            ))}
          </>
        ) : null}
      </div>
    )
  }

  const ownTokens = clipForeign ? tokens.filter(token => isOwnToken(token)) : tokens
  const foreignTokens = clipForeign ? tokens.filter(token => !isOwnToken(token)) : []

  return (
    <>
      {clipForeign ? (
        <div
          className="token-layer token-layer-clip"
          style={{ zIndex: TOKEN_LAYER_Z, width: sceneBounds.width, height: sceneBounds.height }}
        >
          {foreignTokens.map(renderToken)}
        </div>
      ) : null}
      <div className="token-layer" style={{ zIndex: TOKEN_LAYER_Z + 1 }}>
        {ownTokens.map(renderToken)}
      </div>
    </>
  )
}

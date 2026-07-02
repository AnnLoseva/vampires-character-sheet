'use client'

import { useEffect, useRef } from 'react'
import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import type {
  CharacterOption,
  RightRailTab,
  VoiceParticipant,
  VoiceQuality,
} from '@/modules/table/types'
import type { ChatMessage, ChatPanelTab, ChatUser } from '../types'
import { useLang } from '@/lib/i18n/LanguageProvider'

type ChatPanelProps = {
  rightRailTab: RightRailTab
  chatMessages: ChatMessage[]
  chatUser: ChatUser | null
  chatCharacters: CharacterOption[]
  selectedChatCharacterId: string
  chatPanelTab: ChatPanelTab
  voiceStatus: string
  voiceEnabled: boolean
  voiceMuted: boolean
  voiceMasterVolume: number
  voiceQuality: VoiceQuality
  voiceParticipants: VoiceParticipant[]
  chatDraft: string
  voiceAudioRefs: RefObject<Map<string, HTMLAudioElement>>
  remoteStreamsRef: RefObject<Map<string, MediaStream>>
  formatTime: (value: string) => string
  setChatPanelTab: Dispatch<SetStateAction<ChatPanelTab>>
  startVoice: () => Promise<void>
  stopVoice: () => void
  toggleVoiceMuted: () => void
  setVoiceMasterVolume: Dispatch<SetStateAction<number>>
  setVoiceQuality: Dispatch<SetStateAction<VoiceQuality>>
  setVoiceStatus: Dispatch<SetStateAction<string>>
  setVoiceParticipantVolume: (participantId: string, volume: number) => void
  sendChatMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setChatDraft: Dispatch<SetStateAction<string>>
}

export default function ChatPanel({
  rightRailTab,
  chatMessages,
  chatUser,
  chatCharacters,
  selectedChatCharacterId,
  chatPanelTab,
  voiceStatus,
  voiceEnabled,
  voiceMuted,
  voiceMasterVolume,
  voiceQuality,
  voiceParticipants,
  chatDraft,
  voiceAudioRefs,
  remoteStreamsRef,
  formatTime,
  setChatPanelTab,
  startVoice,
  stopVoice,
  toggleVoiceMuted,
  setVoiceMasterVolume,
  setVoiceQuality,
  setVoiceStatus,
  setVoiceParticipantVolume,
  sendChatMessage,
  setChatDraft,
}: ChatPanelProps) {
  const { t, tf } = useLang()
  const chatListRef = useRef<HTMLDivElement>(null)
  const selectedVoiceCharacter = chatCharacters.find(item => item.id === selectedChatCharacterId)
  const canUseChat = Boolean(chatUser && selectedChatCharacterId && chatCharacters.length > 0)

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight })
  }, [chatMessages, rightRailTab, chatPanelTab])

  const composerPlaceholder = !chatUser
    ? t('Войди на главной, чтобы писать')
    : !selectedChatCharacterId || chatCharacters.length === 0
      ? t('Выбери персонажа вверху справа')
      : t('Сообщение в сцену...')

  return (
    <section className={`chat-sidebar table-right-panel ${rightRailTab === 'chat' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Чат стола')}>
      <header>
        <div>
          <span>{t('Чат сцены')}</span>
          <strong>{tf('{count} сообщений', { count: chatMessages.length })}</strong>
        </div>
      </header>

      <nav className="sub-tabs" aria-label={t('Панели чата')}>
        <button type="button" className={chatPanelTab === 'text' ? 'active' : ''} onClick={() => setChatPanelTab('text')}>
          {t('Текст')}
        </button>
        <button type="button" className={chatPanelTab === 'voice' ? 'active' : ''} onClick={() => setChatPanelTab('voice')}>
          {t('Голос')}
        </button>
      </nav>

      <section className={`voice-panel ${chatPanelTab === 'voice' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Голосовой чат')}>
        <header>
          <div>
            <strong>{t('Голос')}</strong>
            <span>{t(voiceStatus)}</span>
          </div>
          <button
            type="button"
            className={voiceEnabled ? 'danger' : ''}
            onClick={voiceEnabled ? stopVoice : () => void startVoice()}
            disabled={!canUseChat}
          >
            {voiceEnabled ? t('Выйти') : t('Войти')}
          </button>
        </header>

        <div className="voice-controls">
          <button
            type="button"
            className={voiceMuted ? 'muted' : ''}
            onClick={toggleVoiceMuted}
            disabled={!voiceEnabled}
          >
            {voiceMuted ? t('Микрофон выкл.') : t('Микрофон вкл.')}
          </button>
          <label>
            <span>{t('Общая громкость')}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voiceMasterVolume}
              onChange={event => setVoiceMasterVolume(Number(event.target.value))}
            />
            <strong>{Math.round(voiceMasterVolume * 100)}%</strong>
          </label>
          <label className="voice-quality">
            <span>{t('Качество')}</span>
            <select
              value={voiceQuality}
              onChange={event => setVoiceQuality(event.target.value as VoiceQuality)}
              disabled={voiceEnabled}
            >
              <option value="clear">{t('Чище голос')}</option>
              <option value="balanced">{t('Шумодав')}</option>
            </select>
          </label>
        </div>

        <div className="voice-participants">
          {voiceEnabled ? (
            <article className="voice-participant self">
              <div className="chat-avatar" aria-hidden="true">
                {selectedVoiceCharacter?.image ? (
                  <img src={selectedVoiceCharacter.image} alt="" />
                ) : (
                  <span>{(selectedVoiceCharacter?.name || t('Я')).slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div>
                <strong>{selectedVoiceCharacter?.name || t('Вы')}</strong>
                <span>{voiceMuted ? t('микрофон выключен') : t('вы в голосе')}</span>
              </div>
            </article>
          ) : null}

          {voiceParticipants.length === 0 ? (
            <p>{voiceEnabled ? t('Пока никого не слышно.') : t('Войди в голос, чтобы слышать участников.')}</p>
          ) : (
            voiceParticipants.map(participant => (
              <article className="voice-participant" key={participant.id}>
                <audio
                  autoPlay
                  playsInline
                  ref={element => {
                    if (!element) {
                      voiceAudioRefs.current.delete(participant.id)
                      return
                    }
                    voiceAudioRefs.current.set(participant.id, element)
                    const stream = remoteStreamsRef.current.get(participant.id)
                    if (stream && element.srcObject !== stream) element.srcObject = stream
                    element.volume = Math.max(0, Math.min(1, participant.volume * voiceMasterVolume))
                    if (stream) element.play().catch(() => setVoiceStatus(t('Нажми на страницу, если браузер заблокировал звук')))
                  }}
                />
                <div className="chat-avatar" aria-hidden="true">
                  {participant.characterImage ? <img src={participant.characterImage} alt="" /> : <span>{participant.characterName.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="voice-participant-main">
                  <div>
                    <strong>{participant.characterName}</strong>
                    <span>{participant.muted ? t('микрофон выключен') : participant.connected ? t('слышно') : t('соединение...')}</span>
                  </div>
                  <label>
                    <span>{t('Громкость')}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={participant.volume}
                      onChange={event => setVoiceParticipantVolume(participant.id, Number(event.target.value))}
                    />
                    <strong>{Math.round(participant.volume * 100)}%</strong>
                  </label>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className={`chat-list ${chatPanelTab === 'text' ? '' : 'table-right-panel-hidden'}`} ref={chatListRef}>
        {chatMessages.length === 0 ? (
          <p className="panel-empty">{t('Сообщений пока нет.')}</p>
        ) : (
          chatMessages.map(message => (
            <article className={`chat-message ${message.userId === chatUser?.id ? 'own' : ''}`} key={message.id}>
              <div className="chat-message-head">
                <div className="chat-avatar" aria-hidden="true">
                  {message.characterImage ? (
                    <img src={message.characterImage} alt="" />
                  ) : (
                    <span>{message.characterName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="chat-message-meta">
                  <strong>{message.characterName}</strong>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </div>
              </div>
              <p>{message.message}</p>
            </article>
          ))
        )}
      </section>

      <form className={`chat-composer ${chatPanelTab === 'text' ? '' : 'table-right-panel-hidden'}`} onSubmit={sendChatMessage}>
        <textarea
          value={chatDraft}
          onChange={event => setChatDraft(event.target.value)}
          placeholder={composerPlaceholder}
          disabled={!canUseChat}
          rows={2}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" disabled={!canUseChat || !chatDraft.trim()}>
          {t('Отправить')}
        </button>
      </form>
    </section>
  )
}
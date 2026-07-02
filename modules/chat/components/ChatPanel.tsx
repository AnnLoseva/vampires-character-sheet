import { useEffect, useRef } from 'react'
import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import type {
  ActiveParticipant,
  CharacterOption,
  RightRailTab,
  VoiceParticipant,
  VoiceQuality,
} from '@/modules/table/types'
import type { ChatAuthMode, ChatMessage, ChatPanelTab, ChatUser } from '../types'
import { useLang } from '@/lib/i18n/LanguageProvider'

type ChatPanelProps = {
  rightRailTab: RightRailTab
  chatMessages: ChatMessage[]
  chatStatus: string
  chatUser: ChatUser | null
  roomParticipants: ActiveParticipant[]
  chatCharacters: CharacterOption[]
  selectedChatCharacterId: string
  chatAuthMode: ChatAuthMode
  chatUsernameDraft: string
  chatPasswordDraft: string
  isChatBusy: boolean
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
  openParticipantPreview: (participant: ActiveParticipant) => Promise<void>
  logoutChat: () => void
  chooseActiveCharacter: (characterId: string) => void
  handleChatAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setChatAuthMode: Dispatch<SetStateAction<'login' | 'register'>>
  setChatUsernameDraft: Dispatch<SetStateAction<string>>
  setChatPasswordDraft: Dispatch<SetStateAction<string>>
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
  chatStatus,
  chatUser,
  roomParticipants,
  chatCharacters,
  selectedChatCharacterId,
  chatAuthMode,
  chatUsernameDraft,
  chatPasswordDraft,
  isChatBusy,
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
  openParticipantPreview,
  logoutChat,
  chooseActiveCharacter,
  handleChatAuth,
  setChatAuthMode,
  setChatUsernameDraft,
  setChatPasswordDraft,
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
  const { t } = useLang()
  const chatListRef = useRef<HTMLDivElement>(null)
  const selectedVoiceCharacter = chatCharacters.find(item => item.id === selectedChatCharacterId)

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight })
  }, [chatMessages, rightRailTab, chatPanelTab])

  return (
    <section className={`chat-sidebar table-right-panel ${rightRailTab === 'chat' ? '' : 'table-right-panel-hidden'}`} aria-label={t('Чат стола')}>
      <div className="chat-login">
        {chatUser ? (
          <>
            <div className="chat-user-row">
              <span>{chatUser.username}</span>
              <button type="button" onClick={logoutChat}>{t('Выйти')}</button>
            </div>
            <label>
              <span>{t('Писать как')}</span>
              <select
                value={selectedChatCharacterId}
                onChange={event => {
                  chooseActiveCharacter(event.target.value)
                }}
              >
                {chatCharacters.length === 0 ? <option value="">{t('Нет сохранённых персонажей')}</option> : null}
                {chatCharacters.map(character => (
                  <option value={character.id} key={character.id}>
                    {character.name}{character.clan ? `, ${character.clan}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {chatCharacters.length === 0 ? <p>{t('Сохрани персонажа на листе в личный кабинет, и он появится здесь.')}</p> : null}
          </>
        ) : (
          <form onSubmit={handleChatAuth}>
            <div className="chat-auth-tabs">
              <button type="button" className={chatAuthMode === 'login' ? 'active' : ''} onClick={() => setChatAuthMode('login')}>{t('Вход')}</button>
              <button type="button" className={chatAuthMode === 'register' ? 'active' : ''} onClick={() => setChatAuthMode('register')}>{t('Регистрация')}</button>
            </div>
            <input
              value={chatUsernameDraft}
              onChange={event => setChatUsernameDraft(event.target.value)}
              placeholder={t('Имя пользователя')}
              autoComplete="username"
            />
            <input
              value={chatPasswordDraft}
              onChange={event => setChatPasswordDraft(event.target.value)}
              placeholder={t('Пароль')}
              type="password"
              autoComplete={chatAuthMode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="submit" disabled={isChatBusy}>{isChatBusy ? '...' : chatAuthMode === 'login' ? t('Войти') : t('Создать аккаунт')}</button>
          </form>
        )}
      </div>

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
            disabled={!chatUser || chatCharacters.length === 0}
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
                  <span>{(selectedVoiceCharacter?.name || chatUser?.username || t('Я')).slice(0, 1).toUpperCase()}</span>
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
              <span>{message.username}</span>
            </article>
          ))
        )}
      </section>

      <form className={`chat-composer ${chatPanelTab === 'text' ? '' : 'table-right-panel-hidden'}`} onSubmit={sendChatMessage}>
        <textarea
          value={chatDraft}
          onChange={event => setChatDraft(event.target.value)}
          placeholder={chatUser ? t('Сообщение в сцену...') : t('Войди, чтобы писать')}
          disabled={!chatUser || chatCharacters.length === 0}
          rows={3}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" disabled={!chatUser || chatCharacters.length === 0 || !chatDraft.trim()}>
          {t('Отправить')}
        </button>
      </form>
    </section>
  )
}

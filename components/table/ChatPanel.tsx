import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react'
import type {
  ActiveParticipant,
  CharacterOption,
  ChatMessage,
  ChatPanelTab,
  ChatUser,
  RightRailTab,
  VoiceParticipant,
  VoiceQuality,
} from '@/lib/table/types'

type ChatPanelProps = {
  rightRailTab: RightRailTab
  chatMessages: ChatMessage[]
  chatStatus: string
  chatUser: ChatUser | null
  roomParticipants: ActiveParticipant[]
  chatCharacters: CharacterOption[]
  selectedChatCharacterId: string
  chatAuthMode: 'login' | 'register'
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
  chatListRef: RefObject<HTMLDivElement | null>
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
  chatListRef,
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
  const selectedVoiceCharacter = chatCharacters.find(item => item.id === selectedChatCharacterId)

  return (
    <section className={`chat-sidebar table-right-panel ${rightRailTab === 'chat' ? '' : 'table-right-panel-hidden'}`} aria-label="Чат стола">
      <header>
        <div>
          <span>Чат</span>
          <strong>{chatMessages.length}</strong>
        </div>
        <div>
          <span>Статус</span>
          <strong>{chatStatus}</strong>
        </div>
      </header>

      <div className="chat-login">
        {chatUser ? (
          <>
            <section className="room-participants-panel" aria-label="Участники комнаты">
              <header>
                <strong>Участники</strong>
                <span>{roomParticipants.length || 1}</span>
              </header>
              <div>
                {roomParticipants.length === 0 ? (
                  <p className="panel-empty">Пока виден только ваш вход.</p>
                ) : roomParticipants.map(participant => (
                  <button type="button" className="participant-row" key={participant.userId} onClick={() => void openParticipantPreview(participant)}>
                    <span className="chat-avatar" aria-hidden="true">
                      {participant.characterImage ? <img src={participant.characterImage} alt="" /> : <span>{participant.characterName.slice(0, 1).toUpperCase()}</span>}
                    </span>
                    <span>
                      <strong>{participant.username}</strong>
                      <small>{participant.characterName || 'без персонажа'}{participant.characterClan ? ` · ${participant.characterClan}` : ''}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <div className="chat-user-row">
              <span>{chatUser.username}</span>
              <button type="button" onClick={logoutChat}>Выйти</button>
            </div>
            <label>
              <span>Писать как</span>
              <select
                value={selectedChatCharacterId}
                onChange={event => {
                  chooseActiveCharacter(event.target.value)
                }}
              >
                {chatCharacters.length === 0 ? <option value="">Нет сохранённых персонажей</option> : null}
                {chatCharacters.map(character => (
                  <option value={character.id} key={character.id}>
                    {character.name}{character.clan ? `, ${character.clan}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {chatCharacters.length === 0 ? <p>Сохрани персонажа на листе в личный кабинет, и он появится здесь.</p> : null}
          </>
        ) : (
          <form onSubmit={handleChatAuth}>
            <div className="chat-auth-tabs">
              <button type="button" className={chatAuthMode === 'login' ? 'active' : ''} onClick={() => setChatAuthMode('login')}>Вход</button>
              <button type="button" className={chatAuthMode === 'register' ? 'active' : ''} onClick={() => setChatAuthMode('register')}>Регистрация</button>
            </div>
            <input
              value={chatUsernameDraft}
              onChange={event => setChatUsernameDraft(event.target.value)}
              placeholder="Имя пользователя"
              autoComplete="username"
            />
            <input
              value={chatPasswordDraft}
              onChange={event => setChatPasswordDraft(event.target.value)}
              placeholder="Пароль"
              type="password"
              autoComplete={chatAuthMode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="submit" disabled={isChatBusy}>{isChatBusy ? '...' : chatAuthMode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
          </form>
        )}
      </div>

      <nav className="sub-tabs" aria-label="Панели чата">
        <button type="button" className={chatPanelTab === 'text' ? 'active' : ''} onClick={() => setChatPanelTab('text')}>
          Текст
        </button>
        <button type="button" className={chatPanelTab === 'voice' ? 'active' : ''} onClick={() => setChatPanelTab('voice')}>
          Голос
        </button>
      </nav>

      <section className={`voice-panel ${chatPanelTab === 'voice' ? '' : 'table-right-panel-hidden'}`} aria-label="Голосовой чат">
        <header>
          <div>
            <strong>Голос</strong>
            <span>{voiceStatus}</span>
          </div>
          <button
            type="button"
            className={voiceEnabled ? 'danger' : ''}
            onClick={voiceEnabled ? stopVoice : () => void startVoice()}
            disabled={!chatUser || chatCharacters.length === 0}
          >
            {voiceEnabled ? 'Выйти' : 'Войти'}
          </button>
        </header>

        <div className="voice-controls">
          <button
            type="button"
            className={voiceMuted ? 'muted' : ''}
            onClick={toggleVoiceMuted}
            disabled={!voiceEnabled}
          >
            {voiceMuted ? 'Микрофон выкл.' : 'Микрофон вкл.'}
          </button>
          <label>
            <span>Общая громкость</span>
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
            <span>Качество</span>
            <select
              value={voiceQuality}
              onChange={event => setVoiceQuality(event.target.value as VoiceQuality)}
              disabled={voiceEnabled}
            >
              <option value="clear">Чище голос</option>
              <option value="balanced">Шумодав</option>
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
                  <span>{(selectedVoiceCharacter?.name || chatUser?.username || 'Я').slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div>
                <strong>{selectedVoiceCharacter?.name || 'Вы'}</strong>
                <span>{voiceMuted ? 'микрофон выключен' : 'вы в голосе'}</span>
              </div>
            </article>
          ) : null}

          {voiceParticipants.length === 0 ? (
            <p>{voiceEnabled ? 'Пока никого не слышно.' : 'Войди в голос, чтобы слышать участников.'}</p>
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
                    if (stream) element.play().catch(() => setVoiceStatus('Нажми на страницу, если браузер заблокировал звук'))
                  }}
                />
                <div className="chat-avatar" aria-hidden="true">
                  {participant.characterImage ? <img src={participant.characterImage} alt="" /> : <span>{participant.characterName.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="voice-participant-main">
                  <div>
                    <strong>{participant.characterName}</strong>
                    <span>{participant.muted ? 'микрофон выключен' : participant.connected ? 'слышно' : 'соединение...'}</span>
                  </div>
                  <label>
                    <span>Громкость</span>
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
          <p className="panel-empty">Сообщений пока нет.</p>
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
          placeholder={chatUser ? 'Сообщение в сцену...' : 'Войди, чтобы писать'}
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
          Отправить
        </button>
      </form>
    </section>
  )
}

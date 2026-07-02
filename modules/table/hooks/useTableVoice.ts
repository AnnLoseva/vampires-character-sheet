'use client'

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { ChatUser } from '@/modules/chat/types'
import type { CharacterOption, VoiceParticipant, VoiceQuality, VoiceSignal } from '../types'
import {
  enhanceVoiceDescription,
  getSavedVoiceVolume,
  getVoiceAudioConstraints,
  tuneVoiceSender,
} from '../utils/voice-webrtc'

export type UseTableVoiceOptions = {
  roomRef: MutableRefObject<string>
  broadcast: (event: string, payload: unknown) => void
  chatUserRef: MutableRefObject<ChatUser | null>
  chatCharactersRef: MutableRefObject<CharacterOption[]>
  selectedChatCharacterIdRef: MutableRefObject<string>
  t: (ru: string) => string
}

export function useTableVoice({
  roomRef,
  broadcast,
  chatUserRef,
  chatCharactersRef,
  selectedChatCharacterIdRef,
  t,
}: UseTableVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Голос выключен')
  const [voiceMasterVolume, setVoiceMasterVolume] = useState(1)
  const [voiceQuality, setVoiceQuality] = useState<VoiceQuality>('clear')
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([])

  const handleVoiceSignalRef = useRef<((signal: VoiceSignal) => void | Promise<void>) | null>(null)
  const voiceEnabledRef = useRef(false)
  const voiceMutedRef = useRef(false)
  const voiceQualityRef = useRef<VoiceQuality>('clear')
  const voiceParticipantsRef = useRef<VoiceParticipant[]>([])
  const voiceMasterVolumeRef = useRef(1)
  const localVoiceStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const voiceAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
  }, [voiceEnabled])

  useEffect(() => {
    voiceMutedRef.current = voiceMuted
  }, [voiceMuted])

  useEffect(() => {
    voiceQualityRef.current = voiceQuality
  }, [voiceQuality])

  useEffect(() => {
    voiceMasterVolumeRef.current = voiceMasterVolume
  }, [voiceMasterVolume])

  useEffect(() => {
    voiceParticipantsRef.current = voiceParticipants
    voiceParticipants.forEach(participant => {
      const audio = voiceAudioRefs.current.get(participant.id)
      if (audio) {
        audio.volume = Math.max(0, Math.min(1, participant.volume * voiceMasterVolume))
      }
    })
  }, [voiceParticipants, voiceMasterVolume])

  const getVoiceIdentity = () => {
    const user = chatUserRef.current
    const character = chatCharactersRef.current.find(item => item.id === selectedChatCharacterIdRef.current)
    if (!user || !character) return null
    return {
      id: user.id,
      username: user.username,
      characterName: character.name,
      characterImage: character.image,
    }
  }

  const upsertVoiceParticipant = (signal: VoiceSignal, patch: Partial<VoiceParticipant> = {}) => {
    if (!signal.from || signal.from === chatUserRef.current?.id) return
    setVoiceParticipants(prev => {
      const existing = prev.find(item => item.id === signal.from)
      const base: VoiceParticipant = {
        id: signal.from,
        username: signal.username || existing?.username || t('Участник'),
        characterName: signal.characterName || existing?.characterName || t('Безымянный'),
        characterImage: signal.characterImage ?? existing?.characterImage ?? '',
        volume: existing?.volume ?? getSavedVoiceVolume(signal.from),
        muted: signal.muted ?? existing?.muted ?? false,
        connected: existing?.connected ?? false,
      }
      const next = { ...base, ...patch }
      return existing ? prev.map(item => (item.id === signal.from ? next : item)) : [...prev, next]
    })
  }

  const removeVoiceParticipant = (participantId: string) => {
    const connection = peerConnectionsRef.current.get(participantId)
    connection?.close()
    peerConnectionsRef.current.delete(participantId)
    remoteStreamsRef.current.delete(participantId)
    voiceAudioRefs.current.delete(participantId)
    setVoiceParticipants(prev => prev.filter(item => item.id !== participantId))
  }

  const setVoiceParticipantVolume = (participantId: string, volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume))
    window.localStorage.setItem(`vtm-voice-volume:${participantId}`, String(nextVolume))
    setVoiceParticipants(prev => prev.map(item => (item.id === participantId ? { ...item, volume: nextVolume } : item)))
  }

  const broadcastVoiceSignal = (signal: Omit<VoiceSignal, 'room' | 'from'>) => {
    const identity = getVoiceIdentity()
    if (!identity) return
    broadcast('voice-signal', {
      ...signal,
      room: roomRef.current,
      from: identity.id,
      username: identity.username,
      characterName: identity.characterName,
      characterImage: identity.characterImage,
      muted: voiceMutedRef.current,
    })
  }

  const attachRemoteStream = (participantId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(participantId, stream)
    const audio = voiceAudioRefs.current.get(participantId)
    if (audio) {
      audio.srcObject = stream
      audio.volume = Math.max(0, Math.min(1, (
        voiceParticipantsRef.current.find(item => item.id === participantId)?.volume ?? 1
      ) * voiceMasterVolumeRef.current))
      audio.play().catch(() => setVoiceStatus('Нажми на страницу, если браузер заблокировал звук'))
    }
  }

  const createVoicePeer = async (participantId: string, offerAfterCreate: boolean) => {
    const existing = peerConnectionsRef.current.get(participantId)
    if (existing && existing.connectionState !== 'closed') return existing

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    peerConnectionsRef.current.set(participantId, connection)
    localVoiceStreamRef.current?.getTracks().forEach(track => {
      const stream = localVoiceStreamRef.current
      if (stream) {
        void tuneVoiceSender(connection.addTrack(track, stream), voiceQualityRef.current)
      }
    })

    connection.onicecandidate = event => {
      if (!event.candidate) return
      broadcastVoiceSignal({
        type: 'ice',
        to: participantId,
        candidate: event.candidate.toJSON(),
      })
    }

    connection.ontrack = event => {
      const [stream] = event.streams
      if (stream) attachRemoteStream(participantId, stream)
      upsertVoiceParticipant({ type: 'join', room: roomRef.current, from: participantId }, { connected: true })
    }

    connection.onconnectionstatechange = () => {
      const connected = connection.connectionState === 'connected'
      const failed = connection.connectionState === 'failed'
        || connection.connectionState === 'closed'
        || connection.connectionState === 'disconnected'
      setVoiceParticipants(prev => prev.map(item => (
        item.id === participantId ? { ...item, connected: connected || (!failed && item.connected) } : item
      )))
      if (failed) setVoiceStatus('Кто-то отключился от голоса')
    }

    if (offerAfterCreate) {
      const offer = await connection.createOffer()
      await connection.setLocalDescription(enhanceVoiceDescription(offer, voiceQualityRef.current))
      broadcastVoiceSignal({
        type: 'offer',
        to: participantId,
        description: connection.localDescription?.toJSON(),
      })
    }

    return connection
  }

  const handleVoiceSignal = async (signal: VoiceSignal) => {
    const currentUser = chatUserRef.current
    if (!signal || signal.room !== roomRef.current || !signal.from || signal.from === currentUser?.id) return

    if (signal.to && signal.to !== currentUser?.id) return

    if (signal.type === 'leave') {
      removeVoiceParticipant(signal.from)
      return
    }

    if (signal.type === 'mute') {
      upsertVoiceParticipant(signal, { muted: Boolean(signal.muted) })
      return
    }

    upsertVoiceParticipant(signal)

    if (!voiceEnabledRef.current || !currentUser) return

    try {
      if (signal.type === 'join') {
        await createVoicePeer(signal.from, true)
        return
      }

      if (signal.type === 'offer' && signal.description) {
        const connection = await createVoicePeer(signal.from, false)
        await connection.setRemoteDescription(signal.description)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(enhanceVoiceDescription(answer, voiceQualityRef.current))
        broadcastVoiceSignal({
          type: 'answer',
          to: signal.from,
          description: connection.localDescription?.toJSON(),
        })
        return
      }

      if (signal.type === 'answer' && signal.description) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection && connection.signalingState !== 'stable') {
          await connection.setRemoteDescription(signal.description)
        }
        return
      }

      if (signal.type === 'ice' && signal.candidate) {
        const connection = peerConnectionsRef.current.get(signal.from)
        if (connection?.remoteDescription) await connection.addIceCandidate(signal.candidate)
      }
    } catch (error) {
      console.error('Не удалось обработать голосовой сигнал:', error)
      setVoiceStatus('Голос не смог соединиться')
    }
  }
  handleVoiceSignalRef.current = handleVoiceSignal

  const stopVoice = () => {
    const wasEnabled = voiceEnabledRef.current
    if (wasEnabled) broadcastVoiceSignal({ type: 'leave' })
    voiceEnabledRef.current = false
    peerConnectionsRef.current.forEach(connection => connection.close())
    peerConnectionsRef.current.clear()
    remoteStreamsRef.current.clear()
    voiceAudioRefs.current.clear()
    localVoiceStreamRef.current?.getTracks().forEach(track => track.stop())
    localVoiceStreamRef.current = null
    setVoiceEnabled(false)
    setVoiceParticipants([])
    setVoiceStatus('Голос выключен')
  }

  const startVoice = async () => {
    const identity = getVoiceIdentity()
    if (!chatUserRef.current) {
      window.alert(t('Сначала войди в аккаунт.'))
      return
    }
    if (!identity) {
      window.alert(t('Выбери персонажа для голоса.'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getVoiceAudioConstraints(voiceQualityRef.current),
      })
      stream.getAudioTracks().forEach(track => {
        track.enabled = !voiceMutedRef.current
      })
      localVoiceStreamRef.current = stream
      voiceEnabledRef.current = true
      setVoiceEnabled(true)
      setVoiceStatus('Голос онлайн')
      broadcastVoiceSignal({ type: 'join' })
    } catch (error) {
      console.error('Микрофон недоступен:', error)
      setVoiceStatus('Микрофон недоступен')
      window.alert(t('Не получилось включить микрофон. Проверь разрешение браузера.'))
    }
  }

  const toggleVoiceMuted = () => {
    const nextMuted = !voiceMutedRef.current
    localVoiceStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted
    })
    setVoiceMuted(nextMuted)
    voiceMutedRef.current = nextMuted
    if (voiceEnabledRef.current) broadcastVoiceSignal({ type: 'mute', muted: nextMuted })
  }

  useEffect(() => () => stopVoice(), [])

  return {
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
  }
}
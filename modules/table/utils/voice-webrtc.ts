import type { VoiceQuality } from '../types'

export function getSavedVoiceVolume(participantId: string) {
  const saved = Number(window.localStorage.getItem(`vtm-voice-volume:${participantId}`))
  return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : 1
}

export function getVoiceBitrate(quality: VoiceQuality) {
  return quality === 'clear' ? 96000 : 64000
}

export function getVoiceAudioConstraints(quality: VoiceQuality): MediaTrackConstraints {
  const clearMode = quality === 'clear'
  return {
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: true,
    noiseSuppression: !clearMode,
    autoGainControl: !clearMode,
  }
}

export function enhanceVoiceSdp(sdp = '', quality: VoiceQuality) {
  const opusPayload = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1]
  if (!opusPayload) return sdp

  const bitrate = getVoiceBitrate(quality)
  const opusOptions = `minptime=10;useinbandfec=1;usedtx=0;maxaveragebitrate=${bitrate};stereo=0;sprop-stereo=0;cbr=1`
  const fmtpPattern = new RegExp(`a=fmtp:${opusPayload} .+`, 'i')

  if (fmtpPattern.test(sdp)) {
    return sdp.replace(fmtpPattern, line => {
      const [, options = ''] = line.split(' ')
      const cleaned = options
        .split(';')
        .map(option => option.trim())
        .filter(option => option && !/^(minptime|useinbandfec|usedtx|maxaveragebitrate|stereo|sprop-stereo|cbr)=/i.test(option))
        .join(';')
      return `a=fmtp:${opusPayload} ${cleaned ? `${cleaned};` : ''}${opusOptions}`
    })
  }

  return sdp.replace(new RegExp(`(a=rtpmap:${opusPayload} opus/48000.*\\r?\\n)`, 'i'), `$1a=fmtp:${opusPayload} ${opusOptions}\r\n`)
}

export function enhanceVoiceDescription(
  description: RTCSessionDescriptionInit,
  quality: VoiceQuality,
): RTCSessionDescriptionInit {
  return {
    type: description.type,
    sdp: enhanceVoiceSdp(description.sdp || '', quality),
  }
}

export async function tuneVoiceSender(sender: RTCRtpSender, quality: VoiceQuality) {
  try {
    const parameters = sender.getParameters()
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}]
    parameters.encodings = parameters.encodings.map(encoding => ({
      ...encoding,
      maxBitrate: getVoiceBitrate(quality),
    }))
    await sender.setParameters(parameters)
  } catch (error) {
    console.warn('Не удалось поднять битрейт голосового sender:', error)
  }
}
import type { Die } from '../types'

export const DIE_IMAGES: Record<Die['kind'], { src: string; label: string }> = {
  fail: { src: '/static/dice/fail.png', label: 'провал' },
  success: { src: '/static/dice/success.png', label: 'успех' },
  critical: { src: '/static/dice/critical-success.png', label: 'критический успех' },
  botch: { src: '/static/dice/fail.png', label: 'провал' },
  'hunger-fail': { src: '/static/dice/hunger-fail.png', label: 'провал Голода' },
  'hunger-success': { src: '/static/dice/hunger-success.png', label: 'успех Голода' },
  'hunger-critical-success': { src: '/static/dice/hunger-critical-success.png', label: 'критический успех Голода' },
  'hunger-critical-fail': { src: '/static/dice/hunger-critical-fail.png', label: 'критический провал Голода' },
}

export function getDieImage(die: Die) {
  return DIE_IMAGES[die.kind] || DIE_IMAGES.fail
}
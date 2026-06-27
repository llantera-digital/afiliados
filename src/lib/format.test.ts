import { describe, expect, it } from 'vitest'
import { formatDate, mxn, statusLabel } from './format'
import { usernameToInternalEmail } from './supabase'

describe('presentación mexicana', () => {
  it('formatea montos en MXN', () => expect(mxn.format(2000)).toContain('2,000.00'))
  it('traduce estados financieros', () => expect(statusLabel.available).toBe('Disponible'))
  it('acepta fechas nulas', () => expect(formatDate(null)).toBe('—'))
})

describe('credenciales simples', () => {
  it('convierte el usuario en identidad interna sin exponer correo real', () => {
    expect(usernameToInternalEmail(' Socio.Demo ')).toBe('socio.demo@afiliados.llantera.digital')
  })
})


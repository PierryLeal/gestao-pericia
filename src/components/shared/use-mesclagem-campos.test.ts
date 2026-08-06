import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMesclagemCampos } from './use-mesclagem-campos';

describe('useMesclagemCampos', () => {
  it('starts with the initial values and nothing marked as edited', () => {
    const { result } = renderHook(() => useMesclagemCampos({ nome: 'João', contato: '123' }));
    expect(result.current.valores).toEqual({ nome: 'João', contato: '123' });
    expect(result.current.foiEditado('nome')).toBe(false);
  });

  it('applying a candidate overwrites every untouched field', () => {
    const { result } = renderHook(() => useMesclagemCampos({ nome: 'João', contato: '123' }));
    act(() => result.current.aplicarCandidato({ nome: 'João 2', contato: '456' }));
    expect(result.current.valores).toEqual({ nome: 'João 2', contato: '456' });
  });

  it('editing a field marks it as edited and applying a candidate no longer overwrites it', () => {
    const { result } = renderHook(() => useMesclagemCampos({ nome: 'João', contato: '123', formacao: '' }));

    act(() => result.current.editarCampo('formacao', 'Engenharia'));
    expect(result.current.foiEditado('formacao')).toBe(true);

    act(() => result.current.aplicarCandidato({ nome: 'João 2', contato: '456', formacao: 'Direito' }));

    expect(result.current.valores).toEqual({ nome: 'João 2', contato: '456', formacao: 'Engenharia' });
  });

  it('keeps an edited field across repeated candidate switches back and forth', () => {
    const { result } = renderHook(() => useMesclagemCampos({ nome: 'João', formacao: '' }));
    const joao = { nome: 'João', formacao: '' };
    const joao2 = { nome: 'João 2', formacao: 'Direito' };

    act(() => result.current.aplicarCandidato(joao2));
    act(() => result.current.editarCampo('formacao', 'Direito'));
    act(() => result.current.aplicarCandidato(joao));
    act(() => result.current.aplicarCandidato(joao2));
    act(() => result.current.aplicarCandidato(joao));

    expect(result.current.valores.formacao).toBe('Direito');
    expect(result.current.valores.nome).toBe('João');
  });
});

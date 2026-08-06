'use client';

import { useState } from 'react';

/**
 * Tracks form field values while merging two or more records (e.g. the
 * colaboradores/peritos picked in a "mesclar" dialog). Switching which
 * candidate currently backs the form (via `aplicarCandidato`) only refills
 * fields the user hasn't touched yet — a field edited manually keeps that
 * value across further candidate switches instead of being silently
 * overwritten, so values from different candidates can be combined into one
 * final record.
 */
export function useMesclagemCampos<T extends Record<string, unknown>>(valoresIniciais: T) {
  const [valores, setValores] = useState<T>(valoresIniciais);
  const [editados, setEditados] = useState<Set<keyof T>>(new Set());

  function editarCampo<K extends keyof T>(campo: K, valor: T[K]) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
    setEditados((atual) => new Set(atual).add(campo));
  }

  function aplicarCandidato(candidato: T) {
    setValores((atual) => {
      const novo = { ...atual };
      for (const campo of Object.keys(candidato) as (keyof T)[]) {
        if (!editados.has(campo)) novo[campo] = candidato[campo];
      }
      return novo;
    });
  }

  function foiEditado(campo: keyof T): boolean {
    return editados.has(campo);
  }

  return { valores, editarCampo, aplicarCandidato, foiEditado };
}

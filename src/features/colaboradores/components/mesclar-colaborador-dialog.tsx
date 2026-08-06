'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/masks';
import { useMesclagemCampos } from '@/components/shared/use-mesclagem-campos';
import { CampoMesclagemLabel } from '@/components/shared/campo-mesclagem-label';
import { PericiasMesclagemPreview } from '@/components/shared/pericias-mesclagem-preview';
import { listPericiasPorColaboradorIds, type PericiaResumoMesclagem } from '@/features/pericias/actions';
import { getColaborador, listColaboradoresOptions, mesclarColaboradores, type Colaborador } from '../actions';

function paraCampos(c: Colaborador) {
  return { nome: c.nome, contato: formatPhone(c.contato), formacao: c.formacao, email: c.email ?? '' };
}

export function MesclarColaboradorDialog({
  colaboradorA,
  open,
  onOpenChange,
  onMerged,
}: {
  colaboradorA: Colaborador;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: (colaborador: Colaborador) => void;
}) {
  const [opcoes, setOpcoes] = useState<{ id: number; nome: string }[]>([]);
  const [opcoesCarregadas, setOpcoesCarregadas] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Colaborador[]>([]);
  const [carregandoId, setCarregandoId] = useState<number | null>(null);
  const [quemFicaId, setQuemFicaId] = useState(colaboradorA.id);
  const { valores, editarCampo, aplicarCandidato, foiEditado } = useMesclagemCampos(paraCampos(colaboradorA));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<PericiaResumoMesclagem[] | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  const candidatos = [colaboradorA, ...selecionados];
  const loserIds = candidatos.map((c) => c.id).filter((id) => id !== quemFicaId);

  async function carregarOpcoes() {
    if (opcoesCarregadas) return;
    const todos = await listColaboradoresOptions();
    setOpcoes(todos.filter((c) => c.id !== colaboradorA.id));
    setOpcoesCarregadas(true);
  }

  async function handleToggleSelecionado(id: number) {
    const jaSelecionado = selecionados.some((c) => c.id === id);
    if (jaSelecionado) {
      setSelecionados((atual) => atual.filter((c) => c.id !== id));
      if (quemFicaId === id) setQuemFicaId(colaboradorA.id);
      return;
    }
    setCarregandoId(id);
    const c = await getColaborador(id);
    setCarregandoId(null);
    if (!c) return;
    setSelecionados((atual) => [...atual, c]);
  }

  function handleRemoverSelecionado(id: number) {
    setSelecionados((atual) => atual.filter((c) => c.id !== id));
    if (quemFicaId === id) setQuemFicaId(colaboradorA.id);
  }

  function handleEscolherQuemFica(c: Colaborador) {
    setQuemFicaId(c.id);
    aplicarCandidato(paraCampos(c));
  }

  async function handleRevisar() {
    if (selecionados.length === 0) return;
    setCarregandoPreview(true);
    setErro(null);
    try {
      const pericias = await listPericiasPorColaboradorIds(loserIds);
      setPreview(pericias);
    } catch {
      setErro('Não foi possível carregar a prévia das perícias afetadas.');
    } finally {
      setCarregandoPreview(false);
    }
  }

  function handleVoltar() {
    setPreview(null);
    setErro(null);
  }

  async function handleConfirmar() {
    setSaving(true);
    setErro(null);
    const resultado = await mesclarColaboradores(quemFicaId, loserIds, valores);
    setSaving(false);
    if (!resultado.success) {
      setErro(resultado.error);
      return;
    }
    onMerged(resultado.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mesclar colaboradores</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Mesclar &quot;{colaboradorA.nome}&quot; com</Label>
            <Popover
              open={popoverOpen}
              onOpenChange={(o) => {
                setPopoverOpen(o);
                if (o) carregarOpcoes();
              }}
            >
              <PopoverTrigger
                render={(
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label="Selecione um ou mais colaboradores"
                    className="w-full justify-between"
                  />
                )}
              >
                <span className="truncate text-muted-foreground">
                  {selecionados.length > 0
                    ? `${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`
                    : 'Selecione um ou mais colaboradores'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                    <CommandGroup>
                      {opcoes.map((option) => {
                        const selecionado = selecionados.some((c) => c.id === option.id);
                        return (
                          <CommandItem
                            key={option.id}
                            value={option.nome}
                            onSelect={() => handleToggleSelecionado(option.id)}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selecionado ? 'opacity-100' : 'opacity-0')} />
                            {option.nome}
                            {carregandoId === option.id && (
                              <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selecionados.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                  >
                    {c.nome}
                    <button
                      type="button"
                      aria-label={`Remover ${c.nome} da mesclagem`}
                      onClick={() => handleRemoverSelecionado(c.id)}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {selecionados.length > 0 && preview === null && (
            <>
              <div className="space-y-2">
                <Label>Manter os dados de</Label>
                <div className="flex flex-wrap gap-2">
                  {candidatos.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={quemFicaId === c.id ? 'default' : 'outline'}
                      onClick={() => handleEscolherQuemFica(c)}
                    >
                      {c.nome}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Os demais registros serão apagados e todas as perícias deles passam a apontar para este. Trocar
                  de candidato preenche os campos abaixo com os dados dele — exceto os que você já editou à mão,
                  que ficam como estão (veja o aviso &quot;editado&quot; em cada um).
                </p>
              </div>

              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-nome" editado={foiEditado('nome')}>Nome</CampoMesclagemLabel>
                <Input id="mesclar-nome" value={valores.nome} onChange={(e) => editarCampo('nome', e.target.value)} />
              </div>
              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-contato" editado={foiEditado('contato')}>
                  Contato
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-contato" value={valores.contato}
                  onChange={(e) => editarCampo('contato', formatPhone(e.target.value))}
                  placeholder="(99) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-formacao" editado={foiEditado('formacao')}>
                  Formação
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-formacao" value={valores.formacao}
                  onChange={(e) => editarCampo('formacao', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-email" editado={foiEditado('email')}>
                  E-mail
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-email" type="email" value={valores.email}
                  onChange={(e) => editarCampo('email', e.target.value)}
                />
              </div>

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <Button type="button" onClick={handleRevisar} disabled={carregandoPreview} className="w-full">
                {carregandoPreview && <Loader2 className="size-4 animate-spin" />}
                {carregandoPreview ? 'Carregando prévia...' : 'Revisar mesclagem'}
              </Button>
            </>
          )}

          {preview !== null && (
            <>
              <PericiasMesclagemPreview pericias={preview} nomeSobrevivente={valores.nome} />

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleVoltar} disabled={saving} className="flex-1">
                  Voltar
                </Button>
                <Button type="button" onClick={handleConfirmar} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? 'Mesclando...' : 'Confirmar mesclagem'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

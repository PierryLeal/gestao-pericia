'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatPhone, formatCPF } from '@/lib/masks';
import { useMesclagemCampos } from '@/components/shared/use-mesclagem-campos';
import { CampoMesclagemLabel } from '@/components/shared/campo-mesclagem-label';
import { PericiasMesclagemPreview } from '@/components/shared/pericias-mesclagem-preview';
import { listPericiasPorPeritoIds, type PericiaResumoMesclagem } from '@/features/pericias/actions';
import { getPerito, listPeritosOptions, mesclarPeritos, type Perito } from '../actions';
import { relacaoOptions, resultadoOptions, type PeritoInput } from '../schemas';

const RELACAO_LABELS: Record<(typeof relacaoOptions)[number], string> = {
  ruim: 'Ruim', neutra: 'Neutra', boa: 'Boa', otima: 'Ótima',
};
const RESULTADO_LABELS: Record<(typeof resultadoOptions)[number], string> = {
  negativo: 'Negativo', parcial: 'Parcial', positivo: 'Positivo',
};

function paraCampos(p: Perito) {
  return {
    nome: p.nome,
    contato: formatPhone(p.contato),
    formacao: p.formacao,
    crea: p.crea,
    documento: formatCPF(p.documento),
    jaTrabalhamos: p.jaTrabalhamos,
    relacao: p.relacao,
    resultados: p.resultados,
  };
}

export function MesclarPeritoDialog({
  peritoA,
  open,
  onOpenChange,
  onMerged,
}: {
  peritoA: Perito;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: (perito: Perito) => void;
}) {
  const [opcoes, setOpcoes] = useState<{ id: number; nome: string }[]>([]);
  const [opcoesCarregadas, setOpcoesCarregadas] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selecionados, setSelecionados] = useState<Perito[]>([]);
  const [carregandoId, setCarregandoId] = useState<number | null>(null);
  const [quemFicaId, setQuemFicaId] = useState(peritoA.id);
  const { valores, editarCampo, aplicarCandidato, foiEditado } = useMesclagemCampos(paraCampos(peritoA));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<PericiaResumoMesclagem[] | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  const candidatos = [peritoA, ...selecionados];
  const loserIds = candidatos.map((p) => p.id).filter((id) => id !== quemFicaId);

  async function carregarOpcoes() {
    if (opcoesCarregadas) return;
    const todos = await listPeritosOptions();
    setOpcoes(todos.filter((p) => p.id !== peritoA.id));
    setOpcoesCarregadas(true);
  }

  async function handleToggleSelecionado(id: number) {
    const jaSelecionado = selecionados.some((p) => p.id === id);
    if (jaSelecionado) {
      setSelecionados((atual) => atual.filter((p) => p.id !== id));
      if (quemFicaId === id) setQuemFicaId(peritoA.id);
      return;
    }
    setCarregandoId(id);
    const p = await getPerito(id);
    setCarregandoId(null);
    if (!p) return;
    setSelecionados((atual) => [...atual, p]);
  }

  function handleRemoverSelecionado(id: number) {
    setSelecionados((atual) => atual.filter((p) => p.id !== id));
    if (quemFicaId === id) setQuemFicaId(peritoA.id);
  }

  function handleEscolherQuemFica(p: Perito) {
    setQuemFicaId(p.id);
    aplicarCandidato(paraCampos(p));
  }

  async function handleRevisar() {
    if (selecionados.length === 0) return;
    setCarregandoPreview(true);
    setErro(null);
    try {
      const pericias = await listPericiasPorPeritoIds(loserIds);
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
    const input: PeritoInput = valores;
    const resultado = await mesclarPeritos(quemFicaId, loserIds, input);
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
          <DialogTitle>Mesclar peritos</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Mesclar &quot;{peritoA.nome}&quot; com</Label>
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
                    aria-label="Selecione um ou mais peritos"
                    className="w-full justify-between"
                  />
                )}
              >
                <span className="truncate text-muted-foreground">
                  {selecionados.length > 0
                    ? `${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`
                    : 'Selecione um ou mais peritos'}
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
                        const selecionado = selecionados.some((p) => p.id === option.id);
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
                {selecionados.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                  >
                    {p.nome}
                    <button
                      type="button"
                      aria-label={`Remover ${p.nome} da mesclagem`}
                      onClick={() => handleRemoverSelecionado(p.id)}
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
                  {candidatos.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={quemFicaId === p.id ? 'default' : 'outline'}
                      onClick={() => handleEscolherQuemFica(p)}
                    >
                      {p.nome}
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
                <CampoMesclagemLabel htmlFor="mesclar-perito-nome" editado={foiEditado('nome')}>
                  Nome
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-perito-nome" value={valores.nome}
                  onChange={(e) => editarCampo('nome', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-perito-contato" editado={foiEditado('contato')}>
                  Contato
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-perito-contato" value={valores.contato}
                  onChange={(e) => editarCampo('contato', formatPhone(e.target.value))}
                  placeholder="(99) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <CampoMesclagemLabel htmlFor="mesclar-perito-formacao" editado={foiEditado('formacao')}>
                  Formação
                </CampoMesclagemLabel>
                <Input
                  id="mesclar-perito-formacao" value={valores.formacao}
                  onChange={(e) => editarCampo('formacao', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <CampoMesclagemLabel htmlFor="mesclar-perito-crea" editado={foiEditado('crea')}>
                    CREA
                  </CampoMesclagemLabel>
                  <Input
                    id="mesclar-perito-crea" value={valores.crea}
                    onChange={(e) => editarCampo('crea', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <CampoMesclagemLabel htmlFor="mesclar-perito-documento" editado={foiEditado('documento')}>
                    Documento
                  </CampoMesclagemLabel>
                  <Input
                    id="mesclar-perito-documento" value={valores.documento}
                    onChange={(e) => editarCampo('documento', formatCPF(e.target.value))}
                    placeholder="999.999.999-99"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="mesclar-perito-ja-trabalhamos" checked={valores.jaTrabalhamos}
                  onCheckedChange={(v) => editarCampo('jaTrabalhamos', v)}
                />
                <CampoMesclagemLabel htmlFor="mesclar-perito-ja-trabalhamos" editado={foiEditado('jaTrabalhamos')}>
                  Já trabalhamos com este perito
                </CampoMesclagemLabel>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <CampoMesclagemLabel htmlFor="mesclar-perito-relacao" editado={foiEditado('relacao')}>
                    Relação
                  </CampoMesclagemLabel>
                  <Select
                    value={valores.relacao}
                    onValueChange={(v) => editarCampo('relacao', v as PeritoInput['relacao'])}
                  >
                    <SelectTrigger id="mesclar-perito-relacao">
                      {RELACAO_LABELS[valores.relacao]}
                    </SelectTrigger>
                    <SelectContent>
                      {relacaoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{RELACAO_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <CampoMesclagemLabel htmlFor="mesclar-perito-resultados" editado={foiEditado('resultados')}>
                    Resultado
                  </CampoMesclagemLabel>
                  <Select
                    value={valores.resultados}
                    onValueChange={(v) => editarCampo('resultados', v as PeritoInput['resultados'])}
                  >
                    <SelectTrigger id="mesclar-perito-resultados">
                      {RESULTADO_LABELS[valores.resultados]}
                    </SelectTrigger>
                    <SelectContent>
                      {resultadoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

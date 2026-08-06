import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PericiasMesclagemPreview } from './pericias-mesclagem-preview';

describe('PericiasMesclagemPreview', () => {
  it('shows a message when no perícias are affected', () => {
    render(<PericiasMesclagemPreview pericias={[]} nomeSobrevivente="João" />);
    expect(screen.getByText(/nenhuma perícia será afetada/i)).toBeInTheDocument();
  });

  it('lists each affected perícia with its processo, date, time and current owner', () => {
    render(
      <PericiasMesclagemPreview
        nomeSobrevivente="João"
        pericias={[
          {
            id: 1, processoNumero: '0001234-56.2026', dataAgendada: '2026-08-10', horaAgendada: '09:00:00',
            situacao: 'marcada', donoAtual: 'João 2',
          },
        ]}
      />
    );

    expect(screen.getByText('0001234-56.2026')).toBeInTheDocument();
    expect(screen.getByText(/10\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/às 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/atualmente com João 2/)).toBeInTheDocument();
    expect(screen.getByText(/1 perícia será reatribuída/i)).toBeInTheDocument();
    expect(screen.getByText('João', { selector: 'strong' })).toBeInTheDocument();
  });

  it('pluralizes the summary line for more than one perícia', () => {
    render(
      <PericiasMesclagemPreview
        nomeSobrevivente="João"
        pericias={[
          { id: 1, processoNumero: 'A', dataAgendada: null, horaAgendada: null, situacao: 'pendente', donoAtual: 'X' },
          { id: 2, processoNumero: 'B', dataAgendada: null, horaAgendada: null, situacao: 'pendente', donoAtual: 'X' },
        ]}
      />
    );

    expect(screen.getByText(/2 perícias serão reatribuídas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sem data/i)).toHaveLength(2);
  });
});

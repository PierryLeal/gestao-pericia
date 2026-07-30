import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RelacaoBadge } from './relacao-badge';

describe('RelacaoBadge', () => {
  it.each([
    ['ruim', 'Ruim'],
    ['neutra', 'Neutra'],
    ['boa', 'Boa'],
    ['otima', 'Ótima'],
  ] as const)('renders the label for %s', (relacao, label) => {
    render(<RelacaoBadge relacao={relacao} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

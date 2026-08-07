import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TooltipField } from './tooltip-field';

describe('TooltipField', () => {
  it('renders the children as-is without a tooltip trigger when the value is empty', () => {
    render(
      <TooltipField value="">
        <input aria-label="campo" defaultValue="" />
      </TooltipField>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByLabelText('campo')).toBeInTheDocument();
  });

  it('shows the full value in a tooltip on hover when there is a value', async () => {
    const user = userEvent.setup();
    render(
      <TooltipField value="Um texto bem longo que não cabe no campo estreito">
        <input aria-label="campo" defaultValue="Um texto bem longo..." readOnly />
      </TooltipField>
    );

    await user.hover(screen.getByLabelText('campo'));

    expect(await screen.findByText('Um texto bem longo que não cabe no campo estreito')).toBeInTheDocument();
  });
});

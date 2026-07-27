import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function TooltipCell({ label, detail }: { label: React.ReactNode; detail: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>{label}</TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}

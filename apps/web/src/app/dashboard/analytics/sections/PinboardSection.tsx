'use client';

import PinboardTab from '../tabs/PinboardTab';
import type { Ticket } from '../types';

interface PinboardSectionProps {
  pins: any[];
  pinsLoading: boolean;
  tickets: Ticket[];
  onUnpin: (id: string, key: string) => void;
  onReorder: (pins: any[]) => void;
  onRefresh: () => void;
}

export default function PinboardSection(props: PinboardSectionProps) {
  return (
    <PinboardTab
      pins={props.pins}
      pinsLoading={props.pinsLoading}
      tickets={props.tickets}
      onUnpin={props.onUnpin}
      onReorder={props.onReorder}
      onRefresh={props.onRefresh}
    />
  );
}

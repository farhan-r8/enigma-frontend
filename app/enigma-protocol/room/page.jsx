import { Suspense } from 'react';
import EnigmaProtocolGame from '../../../components/enigma-protocol/EnigmaProtocolGame';

export default function EnigmaProtocolRoomPage() {
  return (
    <Suspense fallback={null}>
      <EnigmaProtocolGame />
    </Suspense>
  );
}

import styled from 'styled-components';
import Button from '@material-ui/core/Button';
import { CandyMachineAccount } from './candy-machine';
import { CircularProgress } from '@material-ui/core';
import { GatewayStatus, useGateway } from '@civic/solana-gateway-react';
import { useEffect, useState } from 'react';
import Load from './load';
export const CTAButton = styled(Button)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background-image: linear-gradient(45deg,#0070f3 -20%,#94f9f0 50%);
  color: black;
  font-size: 16px;
  font-weight: bold;

  &:disabled{
    color: black;
    background: white;
  }
`; // add your own styles here

export const MintButton = ({
  onMint,
  candyMachine,
  isMinting,
}: {
  onMint: () => Promise<void>;
  candyMachine?: CandyMachineAccount;
  isMinting: boolean;
}) => {
  const { requestGatewayToken, gatewayStatus } = useGateway();
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (gatewayStatus === GatewayStatus.ACTIVE && clicked) {
      onMint();
      setClicked(false);
    }
  }, [gatewayStatus, clicked, setClicked, onMint]);

  const getMintButtonContent = () => {
    if (candyMachine?.state.isSoldOut) {
      return 'SOLD OUT';
    } else if (isMinting) {
      return <Load />;
    } else if (candyMachine?.state.isPresale) {
      return 'PRESALE MINT';
    } else if (clicked && candyMachine?.state.gatekeeper) {
      return <Load />;
    }

    return 'MINT';
  };

  return (
    <CTAButton
      disabled={
        clicked ||
        candyMachine?.state.isSoldOut ||
        isMinting ||
        !candyMachine?.state.isActive
      }
      onClick={async () => {
        setClicked(true);
        if (candyMachine?.state.isActive && candyMachine?.state.gatekeeper) {
          if (gatewayStatus === GatewayStatus.ACTIVE) {
            setClicked(true);
          } else {
            await requestGatewayToken();
          }
        } else {
          await onMint();
          setClicked(false);
        }
      }}
      variant="contained"
    >
      {getMintButtonContent()}
    </CTAButton>
  );
};

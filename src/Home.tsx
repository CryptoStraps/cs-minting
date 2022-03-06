import { useEffect, useMemo, useState, useCallback } from "react";
import * as anchor from "@project-serum/anchor";
import { CrossMintButton } from "@crossmint/client-sdk-react-ui";
import styled from "styled-components";
import { Container, Snackbar, Box } from "@material-ui/core";
import Button from '@material-ui/core/Button';
import Paper from "@material-ui/core/Paper";
import Alert from "@material-ui/lab/Alert";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";
import {
  awaitTransactionSignatureConfirmation,
  CandyMachineAccount,
  CANDY_MACHINE_PROGRAM,
  getCandyMachineState,
  mintOneToken,
} from "./candy-machine";
import { AlertState } from "./utils";
import { Header } from "./Header";
import { MintButton } from "./MintButton";
import { GatewayProvider } from "@civic/solana-gateway-react";
import { getMeta } from "./get-meta";
import ModalUnstyled from '@material-ui/core/Modal';

const ConnectButton = styled(WalletDialogButton)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background-image: linear-gradient(45deg,#0070f3 -20%,#94f9f0 50%);
  color: black;
  font-size: 16px;
  font-weight: bold;
`;

const MintContainer = styled.div`
//  background-color:red;

`; // add your owns styles here

const StyledModal = styled(ModalUnstyled)`
  position: fixed;
  z-index: 1300;
  right: 0;
  bottom: 0;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align:center;
`;

const Backdrop = styled('div')`
  z-index: -1;
  position: fixed;
  right: 0;
  bottom: 0;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.5);
  -webkit-tap-highlight-color: transparent;
`;

const style = {
  width: 400,
  bgcolor: 'black',
  color: 'white',
  border: '2px solid #000',
  borderRadius: "8px",
  p: 2,
  px: 4,
  pb: 3,
  borderImage: "linear-gradient(45deg,#0070f3 -20%,#94f9f0 50%) 1",
  borderStyle: "solid",
  borderWidth: "2px"
};

export const StakeButton = styled(Button)`
  width: 40%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  margin: 2px;
  background-image: linear-gradient(45deg,#0070f3 -20%,#94f9f0 50%);
  color: black;
  font-size: 16px;
  font-weight: bold;
`;

export const AgainButton = styled(Button)`
  width: 40%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  margin: 2px;
  background: white;
  color: black;
  font-size: 16px;
  font-weight: bold;

  &:hover{
    color:white;
  }
`;

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  txTimeout: number;
  rpcHost: string;
  endpoint: string;
}

const Home = (props: HomeProps) => {
  const { connection } = props;
  const [meta, setMeta] = useState<any>();
  const [isUserMinting, setIsUserMinting] = useState(false);
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const rpcUrl = props.rpcHost;
  const wallet = useWallet();

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet]);

  const refreshCandyMachineState = useCallback(async () => {
    if (!anchorWallet) {
      return;
    }

    if (props.candyMachineId) {
      try {
        const cndy = await getCandyMachineState(
          anchorWallet,
          props.candyMachineId,
          connection
        );
        console.log(JSON.stringify(cndy.state, null, 4));
        setCandyMachine(cndy);
      } catch (e) {
        console.log("There was a problem fetching Candy Machine state");
        console.log(e);
      }
    }
  }, [anchorWallet, props.candyMachineId, connection]);

  const onMint = async () => {
    try {
      setIsUserMinting(true);
      document.getElementById("#identity")?.click();
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        const mintTxId = (
          await mintOneToken(candyMachine, wallet.publicKey)
        )[0];

        let status: any = { err: true };
        let mintTx;
        if (mintTxId) {
          status = await awaitTransactionSignatureConfirmation(
            mintTxId,
            props.txTimeout,
            connection,
            true
          );
          let counter = 0;
          const timeout = 500;
          const tries = 200;
          while (!mintTx) {
            mintTx = await connection.getTransaction(mintTxId, {
              commitment: "finalized",
            });
            await new Promise((resolve) =>
              setTimeout(() => resolve(""), timeout)
            );
            counter += 1;
            if (tries === counter) {
              // stop at 200*500ms = 100s
              setAlertState({
                open: true,
                message: "Could not fetch metadata, please check your wallet.",
                severity: "error",
              });
              break;
            }
          }
        }

        if (mintTx?.meta?.postTokenBalances) {
          // After this we can show dialogue with video
          const mint = mintTx?.meta?.postTokenBalances[0]?.mint;
          const meta = ((await getMeta(mint, props.endpoint)) as any[])[0];
          setMeta(meta.metadata.animation_url);
          handleOpen()
          console.log("META", meta.metadata.animation_url)
        }

        if (status && !status.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction Timeout! Please try again.";
        } else if (error.message.indexOf("0x137")) {
          message = `Error! Please check wallet to see if Strap was minted and reload site.`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setIsUserMinting(false);
    }
  };

  useEffect(() => {
    refreshCandyMachineState();
  }, [
    anchorWallet,
    props.candyMachineId,
    connection,
    refreshCandyMachineState,
  ]);

  const MintButtons = () => {
    return (
      <>
        <MintButton
          candyMachine={candyMachine}
          isMinting={isUserMinting}
          onMint={onMint}
        />
        {(candyMachine?.state?.goLiveDate?.toNumber() || 0) * 1000 <=
          Date.now() && (
          <div className="CrossMint">
            <CrossMintButton
           
              collectionTitle="CryptoStraps"
              collectionDescription="CryptoStraps is a next-gen 3D animated NFT pushing all boundaries and breathing new life into the ecosystem with their innovate tech."
              collectionPhoto="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2Pyc8DkCgPohR1o3ExMx84fLxU8ti1eQnySUwJMh5E6d/logo.png"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <Container className="main" maxWidth="lg">
      <div className="vidWrapper">
          <video className="bgVid" webkit-playsinline="true" autoPlay loop muted playsInline poster="" style={{display:"block"}}>
              <source src="/ammo4.mp4" type="video/mp4"/>
          </video>
      </div>
      <div className="mintCont">
      {/* <Container  className="logo">
          <img alt="cs" src="/ltrans.png"></img>
      </Container> */}
      <Container maxWidth="xs" style={{ position: "relative" }}>
        <Paper
          style={{ padding: 24, backgroundColor: "rgb(21 26 31 / 55%)", borderRadius: 6 }}
        >
          {!wallet.connected ? (<>
            <div  className="logo">
                  <img alt="cs" src="/ltrans.png"></img>
              </div> 
              <ConnectButton className="CSbutton">Connect Wallet</ConnectButton>
          </>
            
          ) : (
            <>
               <div  className="logo">
                  <img alt="cs" src="/ltrans.png"></img>
              </div>
              <Header candyMachine={candyMachine} />
              <MintContainer>
                {candyMachine?.state.isActive &&
                candyMachine?.state.gatekeeper &&
                wallet.publicKey &&
                wallet.signTransaction ? (
                  <GatewayProvider
                    wallet={{
                      publicKey:
                        wallet.publicKey ||
                        new PublicKey(CANDY_MACHINE_PROGRAM),
                      //@ts-ignore
                      signTransaction: wallet.signTransaction,
                    }}
                    gatekeeperNetwork={
                      candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                    }
                    clusterUrl={rpcUrl}
                    options={{ autoShowModal: false }}
                  >
                    <MintButtons />
                  </GatewayProvider>
                ) : (
                  <MintButtons />
                )}
              </MintContainer>
            </>
          )}
        </Paper>
      </Container>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
      <div style={{position: 'relative'}}>
          {/* <button type="button" onClick={handleOpen}>
            Open modal
          </button> */}
          <StyledModal
            aria-labelledby="unstyled-modal-title"
            aria-describedby="unstyled-modal-description"
            open={open}
            onClose={handleClose}
            BackdropComponent={Backdrop}
          >
            <Box sx={style}>
              <h2 id="unstyled-modal-title">CRYPTOSTRAP REVEAL</h2>
              <p id="unstyled-modal-description">LOCK AND LOAD!</p>
              <div className="CSNFT">
                            <video className="CSNFTVID" webkit-playsinline="true" autoPlay loop muted playsInline poster="" style={{display:"block", width: "100%"}}>
                                <source src={meta} type="video/mp4"/>
                            </video>
              </div>
              <StakeButton>STAKE</StakeButton>
              <AgainButton onClick={handleClose}>MINT ANOTHER</AgainButton>
            </Box>
          </StyledModal>
        </div>

      </div>
 
    </Container>
  );
};

export default Home;

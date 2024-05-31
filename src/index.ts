const { Elm } = require("./Main.elm");

import { ElmApp, Wallet } from "./ports";
import { toBigIntBE } from "bigint-buffer";
import { decodeJwt } from "jose";
import {
  generateNonce,
  getZkLoginSignature,
  generateRandomness,
  genAddressSeed,
} from "@mysten/zklogin";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { computeZkLoginAddressFromSeed } from "@mysten/sui/zklogin";
import { bcs } from "@mysten/sui/bcs";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { requestSuiFromFaucetV0, getFaucetHost } from "@mysten/sui/faucet";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair, Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";

if (window.navigator.serviceWorker) {
  window.navigator.serviceWorker.register("/sw.js");
}

const config = {
  network: "testnet",
  //network: "devnet",
  //network: "mainnet",
};

const provider = new SuiClient({
  url: getFullnodeUrl(config.network as any),
});

const PARAMS = "PARAMS";
const ACCOUNT = "ACCOUNT";

interface Params {
  epoch: number;
  randomness: string;
  ephPublic: string;
  ephPrivate: string;
}

interface ZkAccount {
  inputs: any;
  //inputs: ZkSignatureInputs;
  jwt: string;
  sub: string;
  address: string;
}

(async () => {
  const qs = new URLSearchParams(window.location.href);
  const jwt = qs.get("id_token")!;
  const savedWallet = getWallet();

  const app: ElmApp = Elm.Main.init({
    node: document.getElementById("app"),
    flags: { wallet: savedWallet, isRegistering: Boolean(jwt) },
  });

  const refreshBalance = async (wallet: string) => {
    const bal = await provider.getBalance({ owner: wallet });
    app.ports.balanceCb.send(bal.totalBalance);
  };

  if (savedWallet) {
    refreshBalance(savedWallet.address);
  }

  if (jwt) {
    (async () => {
      window.history.replaceState({}, document.title, "/");

      const store = localStorage.getItem(PARAMS);

      if (!store) {
        return;
      }

      const params: Params = JSON.parse(store);

      const salt = BigInt("123");
      //const { salt }: { salt: string } = await fetch("http://salt.api.mystenlabs.com/get_salt", {
      //method: "POST",
      //headers: {
      //"Content-Type": "application/json",
      //},
      //body: JSON.stringify({
      //token: jwt,
      //}),
      //}).then((res) => res.json());

      const partialZk = createPartialZKSignature(
        jwt,
        new Ed25519PublicKey(params.ephPublic),
        params.epoch,
        BigInt(params.randomness),
        salt
      );

      // Client id needs to be whitelisted
      const proofs = await fetch("https://prover.mystenlabs.com/v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(partialZk),
      }).then((res) => res.json());

      const jwtParsed = decodeJwt(jwt);

      const addressSeed = genAddressSeed(
        salt,
        "sub",
        jwtParsed.sub!,
        Array.isArray(jwtParsed.aud) ? jwtParsed.aud[0] : jwtParsed.aud!
      );

      const addr = computeZkLoginAddressFromSeed(addressSeed, jwtParsed.iss!);

      const inputs = {
        ...proofs,
        addressSeed: addressSeed.toString(),
      };

      localStorage.setItem(
        ACCOUNT,
        JSON.stringify({ inputs, jwt, sub: jwtParsed.sub!, address: addr })
      );

      app.ports.walletCb.send({
        address: addr,
        ephPublic: params.ephPublic,
        googleSub: jwtParsed.sub!,
      });

      refreshBalance(addr);
    })().catch(console.error);
  }

  app.ports.airdrop.subscribe(() => {
    const wallet = getWallet()!;
    requestSuiFromFaucetV0({
      host: getFaucetHost(config.network as any),
      recipient: wallet.address,
    })
      .then((res) => {
        console.log(res);
        alert("Airdrop successful!");
      })
      .catch(() => alert("There was a problem!"));
  });

  app.ports.zkLogin.subscribe(() => {
    zkLogin();
  });

  app.ports.getBalance.subscribe(() => {
    const wallet = getWallet()!;
    refreshBalance(wallet.address);
  });

  app.ports.copy.subscribe((val) => {
    navigator.clipboard.writeText(val);
  });

  app.ports.logout.subscribe(() => {
    [PARAMS, ACCOUNT].forEach((k) => {
      localStorage.removeItem(k);
    });
  });

  app.ports.transfer.subscribe(({ target, amount }) =>
    (async () => {
      const txb = new Transaction();
      const [coin] = txb.splitCoins(txb.gas, [bcs.u64().serialize(amount)]);
      txb.transferObjects([coin], bcs.Address.serialize(target));

      const params: Params = JSON.parse(localStorage.getItem(PARAMS)!);
      const account: ZkAccount = JSON.parse(localStorage.getItem(ACCOUNT)!);

      txb.setSender(account.address);

      const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
        decodeSuiPrivateKey(params.ephPrivate).secretKey
      );

      const preSign = await txb.sign({
        client: provider,
        signer: ephemeralKeyPair,
      });

      const zkSignature = getZkLoginSignature({
        inputs: account.inputs,
        maxEpoch: params.epoch,
        userSignature: preSign.signature,
      });

      const res = await provider.executeTransactionBlock({
        transactionBlock: preSign.bytes,
        signature: zkSignature,
      });

      app.ports.sigCb.send(res.digest);
    })().catch(console.error)
  );
})().catch(console.error);

function getWallet(): Wallet | null {
  const state = localStorage.getItem(ACCOUNT);
  const state2 = localStorage.getItem(PARAMS);
  if (!state || !state2) {
    return null;
  }
  const account: ZkAccount = JSON.parse(state);
  const params: Params = JSON.parse(state2);
  return {
    address: account.address,
    ephPublic: params.ephPublic,
    googleSub: account.sub,
  };
}

async function zkLogin() {
  const { epoch } = await provider.getLatestSuiSystemState();

  const maxEpoch = Number(epoch) + 2;
  const ephemeralKeyPair = new Ed25519Keypair();

  const randomness = generateRandomness();
  const params: Params = {
    epoch: maxEpoch,
    randomness: randomness.toString(),
    ephPublic: ephemeralKeyPair.getPublicKey().toBase64(),
    ephPrivate: ephemeralKeyPair.getSecretKey(),
  };
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness
  );

  const queryParams = new URLSearchParams({
    state: new URLSearchParams({
      redirect_uri: window.location.origin + "/",
    }).toString(),
    client_id:
      "25769832374-famecqrhe2gkebt5fvqms2263046lj96.apps.googleusercontent.com",
    // Need to manually copy the auth tokens from the url after redirect
    redirect_uri: "https://sui.io/",
    response_type: "id_token",
    scope: "openid",
    nonce: nonce,
  });

  const loginURL = `https://accounts.google.com/o/oauth2/v2/auth?${queryParams}`;

  localStorage.setItem(PARAMS, JSON.stringify(params));

  window.location.replace(loginURL);
}

function createPartialZKSignature(
  jwt: string,
  ephemeralPublicKey: Ed25519PublicKey,
  maxEpoch: number,
  jwtRandomness: bigint,
  userSalt: bigint
) {
  return {
    jwt,
    extendedEphemeralPublicKey: toBigIntBE(
      Buffer.from(ephemeralPublicKey.toSuiBytes())
    ).toString(),
    maxEpoch,
    jwtRandomness: jwtRandomness.toString(),
    salt: userSalt.toString(),
    keyClaimName: "sub",
  };
}

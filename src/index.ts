const { Elm } = require("./Main.elm");

import { ElmApp } from "./ports";
import { toBigIntBE } from "bigint-buffer";
import { decodeJwt } from "jose";
import {
  generateNonce,
  getZkSignature,
  generateRandomness,
  genAddressSeed,
  jwtToAddress,
  ZkSignatureInputs,
} from "@mysten/zklogin";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { requestSuiFromFaucetV0, getFaucetHost } from "@mysten/sui.js/faucet";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui.js/keypairs/ed25519";

if (window.navigator.serviceWorker) {
  window.navigator.serviceWorker.register("/sw.js");
}

const config = {
  //network: "testnet",
  //salt: "http://salt.api-testnet.mystenlabs.com/get_salt",
  network: "devnet",
  salt: "http://salt.api-devnet.mystenlabs.com/get_salt",
};

const proxy = (url: string) => "https://cors-proxy.fringe.zone/" + url;

const provider = new SuiClient({
  url: getFullnodeUrl(config.network as any),
});

const STATE = "STATE";
const JWT = "JWT";
const INPUTS = "INPUTS";
const ADDRESS = "ADDR";

interface Params {
  epoch: number;
  randomness: string;
  ephPublic: string;
  ephPrivate: string;
}

(async () => {
  const qs = new URLSearchParams(window.location.href);
  const jwt = qs.get("id_token")!;
  const savedAddress = localStorage.getItem(ADDRESS);

  const app: ElmApp = Elm.Main.init({
    node: document.getElementById("app"),
    flags: { addr: savedAddress, isRegistering: Boolean(jwt) },
  });

  const refreshBalance = async (wallet: string) => {
    const bal = await provider.getBalance({ owner: wallet });
    app.ports.balanceCb.send(bal.totalBalance);
  };

  if (savedAddress) {
    refreshBalance(savedAddress);
  }

  if (jwt) {
    window.history.replaceState({}, document.title, "/");

    const state: Params = JSON.parse(localStorage.getItem(STATE)!);

    const { salt }: { salt: string } = await fetch(proxy(config.salt), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: jwt,
      }),
    }).then((res) => res.json());

    const partialZk = createPartialZKSignature(
      jwt,
      new Ed25519PublicKey(state.ephPublic),
      state.epoch,
      BigInt(state.randomness),
      salt
    );

    const proofs = await fetch(proxy("https://prover.mystenlabs.com/v1"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(partialZk),
    }).then((res) => res.json());

    const jwtParsed = decodeJwt(jwt);

    const addressSeed = genAddressSeed(
      BigInt(salt),
      "sub",
      jwtParsed.sub!,
      Array.isArray(jwtParsed.aud) ? jwtParsed.aud[0] : jwtParsed.aud!
    );

    const addr = jwtToAddress(jwt, BigInt(salt));

    const inputs: ZkSignatureInputs = {
      ...proofs,
      addressSeed: addressSeed.toString(),
    };

    localStorage.setItem(INPUTS, JSON.stringify(inputs));
    localStorage.setItem(JWT, jwt);
    localStorage.setItem(ADDRESS, addr);

    app.ports.walletCb.send(addr);

    refreshBalance(addr);
  }

  app.ports.airdrop.subscribe(() => {
    const addr = localStorage.getItem(ADDRESS)!;
    requestSuiFromFaucetV0({
      host: getFaucetHost(config.network as any),
      recipient: addr,
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
    const addr = localStorage.getItem(ADDRESS)!;
    refreshBalance(addr);
  });

  app.ports.copy.subscribe((val) => {
    navigator.clipboard.writeText(val);
  });

  app.ports.logout.subscribe(() => {
    [STATE, JWT, INPUTS, ADDRESS].forEach((k) => {
      localStorage.removeItem(k);
    });
  });

  app.ports.transfer.subscribe(async ({ target, amount }) => {
    const txb = new TransactionBlock();
    const [coin] = txb.splitCoins(txb.gas, [txb.pure(amount)]);
    txb.transferObjects([coin], txb.pure(target));

    const state: Params = JSON.parse(localStorage.getItem(STATE) as any);
    const inputs: ZkSignatureInputs = JSON.parse(
      localStorage.getItem(INPUTS) as any
    );

    const addr: string = localStorage.getItem(ADDRESS)!;

    txb.setSender(addr);

    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
      Buffer.from(state.ephPrivate, "base64")
    );

    const preSign = await txb.sign({
      client: provider,
      signer: ephemeralKeyPair,
    });

    const zkSignature = getZkSignature({
      inputs: inputs,
      maxEpoch: state.epoch,
      userSignature: preSign.signature,
    });

    const res = await provider.executeTransactionBlock({
      transactionBlock: preSign.bytes,
      signature: zkSignature,
    });

    app.ports.sigCb.send(res.digest);
  });
})().catch(console.error);

async function zkLogin() {
  const { epoch } = await provider.getLatestSuiSystemState();

  const maxEpoch = Number(epoch) + 2;
  const ephemeralKeyPair = new Ed25519Keypair();

  const randomness = generateRandomness();
  const state: Params = {
    epoch: maxEpoch,
    randomness: randomness.toString(),
    ephPublic: ephemeralKeyPair.getPublicKey().toBase64(),
    ephPrivate: ephemeralKeyPair.export().privateKey,
  };
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness
  );

  const params = new URLSearchParams({
    state: new URLSearchParams({
      redirect_uri: window.location.origin + "/",
    }).toString(),
    client_id:
      "25769832374-famecqrhe2gkebt5fvqms2263046lj96.apps.googleusercontent.com",
    redirect_uri: "https://zklogin-dev-redirect.vercel.app/api/auth",
    response_type: "id_token",
    scope: "openid",
    nonce: nonce,
  });

  const loginURL = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  localStorage.setItem(STATE, JSON.stringify(state));

  window.location.replace(loginURL);
}

function createPartialZKSignature(
  jwt: string,
  ephemeralPublicKey: Ed25519PublicKey,
  maxEpoch: number,
  jwtRandomness: bigint,
  userSalt: string
) {
  return {
    jwt,
    extendedEphemeralPublicKey: toBigIntBE(
      Buffer.from(ephemeralPublicKey.toSuiBytes())
    ).toString(),
    maxEpoch,
    jwtRandomness: jwtRandomness.toString(),
    salt: userSalt,
    keyClaimName: "sub",
  };
}

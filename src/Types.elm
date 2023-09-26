module Types exposing (Flags, Model, Msg(..))

import Ports


type alias Model =
    { wallet : Maybe Ports.Wallet
    , balance : Int
    , fieldAddr : String
    , fieldAmt : String
    , txs : List String
    , registering : Bool
    }


type alias Flags =
    { wallet : Maybe Ports.Wallet
    , isRegistering : Bool
    }


type Msg
    = WalletCb Ports.Wallet
    | Transfer
    | SigCb String
    | FieldChange String
    | FieldAmtChange String
    | ZkConnect
    | Logout
    | Copy String
    | BalanceCb String
    | Airdrop
    | GetBalance

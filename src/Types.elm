module Types exposing (Flags, Model, Msg(..))


type alias Model =
    { wallet : Maybe String
    , balance : Int
    , fieldAddr : String
    , fieldAmt : String
    , txs : List String
    , registering : Bool
    }


type alias Flags =
    { addr : Maybe String
    , isRegistering : Bool
    }


type Msg
    = WalletCb String
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

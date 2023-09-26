port module Ports exposing (..)


type alias Wallet =
    { address : String
    , ephPublic : String
    , googleSub : String
    }



-- OUT


port airdrop : () -> Cmd msg


port zkLogin : () -> Cmd msg


port getBalance : () -> Cmd msg


port log : String -> Cmd msg


port copy : String -> Cmd msg


port transfer : { target : String, amount : String } -> Cmd msg


port logout : () -> Cmd msg



-- IN


port walletCb : (Wallet -> msg) -> Sub msg


port sigCb : (String -> msg) -> Sub msg


port balanceCb : (String -> msg) -> Sub msg

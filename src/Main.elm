module Main exposing (main)

import Browser
import Ports
import Types exposing (..)
import Update exposing (update)
import View exposing (view)


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { wallet = flags.addr
      , fieldAddr = ""
      , fieldAmt = ""
      , txs = []
      , balance = 0
      , registering = flags.isRegistering
      }
    , Cmd.none
    )


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ Ports.walletCb WalletCb
        , Ports.sigCb SigCb
        , Ports.balanceCb BalanceCb
        ]

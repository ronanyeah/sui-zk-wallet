module Update exposing (update)

import Maybe.Extra exposing (unwrap)
import Ports
import Types exposing (Model, Msg(..))


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        WalletCb x ->
            ( { model
                | wallet = Just x
                , registering = False
              }
            , Cmd.none
            )

        Airdrop ->
            ( model, Ports.airdrop () )

        Logout ->
            ( { model | wallet = Nothing }, Ports.logout () )

        SigCb x ->
            ( { model
                | txs = x :: model.txs
                , fieldAmt = ""
                , fieldAddr = ""
              }
            , Cmd.none
            )

        FieldChange xs ->
            ( { model | fieldAddr = xs }, Cmd.none )

        FieldAmtChange xs ->
            ( { model | fieldAmt = xs }, Cmd.none )

        BalanceCb bal ->
            ( { model
                | balance =
                    String.toInt bal
                        |> Maybe.withDefault 0
              }
            , Cmd.none
            )

        Copy val ->
            ( model
            , Ports.copy val
            )

        GetBalance ->
            ( model
            , Ports.getBalance ()
            )

        ZkConnect ->
            ( model
            , Ports.zkLogin ()
            )

        Transfer ->
            let
                val =
                    Maybe.map2
                        (\addr amt ->
                            { target = addr
                            , amount = String.fromInt (amt * 1000000000 |> round)
                            }
                        )
                        (if String.isEmpty model.fieldAddr then
                            Nothing

                         else
                            Just model.fieldAddr
                        )
                        (String.toFloat model.fieldAmt)
            in
            val
                |> unwrap ( model, Cmd.none )
                    (\x ->
                        ( model
                        , Ports.transfer x
                        )
                    )

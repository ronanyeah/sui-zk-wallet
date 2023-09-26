module View exposing (view)

import Element exposing (..)
import Element.Background as Background
import Element.Border as Border
import Element.Font as Font
import Element.Input as Input
import FormatNumber
import FormatNumber.Locales exposing (usLocale)
import Helpers.View exposing (..)
import Html exposing (Html)
import Html.Attributes
import Material.Icons as Icons
import Material.Icons.Types exposing (Icon)
import Maybe.Extra exposing (unwrap)
import Types exposing (..)


view : Model -> Html Msg
view model =
    [ [ img "/sui.png" [ width <| px 30 ]
      , text "Sui ZK Wallet"
            |> el [ Font.size 25, Font.bold ]
      ]
        |> row [ spacing 20, centerX ]
    , model.wallet
        |> unwrap
            (if model.registering then
                [ text "Wallet is initialising...", spinner 40 ]
                    |> row [ centerX, spacing 20 ]

             else
                [ Input.button
                    [ paddingXY 20 10
                    , Border.width 1
                    , Border.rounded 5
                    , Background.color white
                    , hover
                    ]
                    { onPress = Just ZkConnect
                    , label =
                        [ img "/g-logo.png" [ width <| px 30 ]
                        , text "Authenticate with Google"
                        ]
                            |> row [ spacing 20 ]
                    }
                , sourceCode
                    |> el [ centerX ]
                ]
                    |> column [ spacing 20, centerX ]
            )
            (\w ->
                [ [ text "Wallet Loaded:"
                        |> el [ Font.bold ]
                  , [ newTabLink [ hover, Font.underline ]
                        { url = "https://explorer.sui.io/address/" ++ w.address ++ "?network=" ++ env
                        , label =
                            text <| (String.left 8 w.address ++ "..." ++ String.right 8 w.address)
                        }
                    , btnWhite (Copy w.address) "Copy"
                    ]
                        |> row [ spacing 20 ]
                  ]
                    |> column [ spacing 5 ]
                , [ text "Balance:"
                        |> el [ Font.bold ]
                  , toFloat model.balance
                        / 1000000000.0
                        |> formatFloat
                        |> text
                  , text "SUI"
                  , btnWhite GetBalance "Refresh"
                  ]
                    |> row [ spacing 10 ]
                , [ text "Ephemeral public key:"
                        |> el [ Font.bold ]
                  , [ text w.ephPublic ]
                        |> paragraph [ Font.size 12 ]
                  ]
                    |> column [ spacing 10 ]
                , [ text "Google JWT sub:"
                        |> el [ Font.bold ]
                  , text w.googleSub
                  ]
                    |> column [ spacing 10 ]
                , [ [ text "Network:"
                        |> el [ Font.bold ]
                    , text env
                    ]
                        |> row [ spacing 10 ]
                  , btnWhite Airdrop "Request airdrop"
                        |> el [ alignRight ]
                  ]
                    |> wrappedRow [ spacing 10, width fill ]
                , [ text "Transfer SUI"
                        |> el [ Font.bold ]
                  , Input.text [ width fill ]
                        { label = Input.labelHidden ""
                        , onChange = FieldChange
                        , placeholder = Just <| Input.placeholder [] <| text "Recipient"
                        , text = model.fieldAddr
                        }
                  , Input.text
                        [ Html.Attributes.type_ "number"
                            |> htmlAttribute
                        ]
                        { label = Input.labelHidden ""
                        , onChange = FieldAmtChange
                        , placeholder = Just <| Input.placeholder [] <| text "Amount"
                        , text = model.fieldAmt
                        }
                  , btnWhite Transfer "Send"
                        |> el [ alignRight ]
                  , model.txs
                        |> List.map
                            (\tx ->
                                newTabLink [ hover ]
                                    { url = "https://explorer.sui.io/txblock/" ++ tx ++ "?network=" ++ env
                                    , label =
                                        text <| "Tx: " ++ (String.left 6 tx ++ "..." ++ String.right 6 tx)
                                    }
                            )
                        |> column [ spacing 10 ]
                  ]
                    |> column
                        [ spacing 20
                        , width fill
                        , Background.color white
                        , padding 20
                        , Border.rounded 10
                        , Border.width 1
                        ]
                , [ sourceCode
                  , btnWhite Logout "Logout"
                        |> el [ alignRight ]
                  ]
                    |> row [ width fill ]
                ]
                    |> column [ spacing 20, width fill ]
            )
    ]
        |> column [ centerX, spacing 40, paddingXY 20 40, cappedWidth 450 ]
        |> Element.layoutWith
            { options =
                [ Element.focusStyle
                    { borderColor = Nothing
                    , backgroundColor = Nothing
                    , shadow = Nothing
                    }
                ]
            }
            [ width fill
            , height fill
            , scrollbarY
            , Font.size 17
            , monospaceFont
            , Background.gradient
                { angle = degrees -30
                , steps =
                    [ rgb255 150 150 220
                    , rgb255 220 220 220
                    ]
                }
            ]


sourceCode =
    newTabLink [ hover, Font.underline ]
        { url = "https://github.com/ronanyeah/sui-zk-wallet"
        , label = text "View source code"
        }


icon : Icon msg -> Int -> Element msg
icon ic n =
    ic n Material.Icons.Types.Inherit
        |> html
        |> el []


spinner : Int -> Element msg
spinner n =
    icon Icons.flare n
        |> el [ spin ]


spin : Attribute msg
spin =
    style "animation" "rotation 0.7s infinite linear"


btnWhite msg txt =
    Input.button
        [ paddingXY 10 5
        , Border.width 1
        , Border.rounded 5
        , Background.color white
        , hover
        ]
        { onPress = Just msg, label = text txt }


white =
    rgb255 255 255 255


hover : Attribute msg
hover =
    Element.mouseOver [ fade ]


fade : Element.Attr a b
fade =
    Element.alpha 0.6


img src attrs =
    image attrs
        { src = src
        , description = ""
        }


monospaceFont =
    Font.family [ Font.monospace ]


formatFloat =
    FormatNumber.format
        { usLocale | decimals = FormatNumber.Locales.Max 2 }


env =
    --"testnet"
    "devnet"

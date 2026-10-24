# 03 — Set 1: World War II ("ww2")

Status: draft v0.2. Stats are first-pass and must be tuned by simulation (doc 05). Costs: **Mp** Manpower, **St** Steel, **Fu** Fuel, **Su** Supplies.

Set size: **12 Buildings, 39 Units, 12 Orders = 63 cards.** Rarity split: C 24 · U 22 · R 13 · L 4 (see §7).

## 1. Design goals for the set
1. Four resources, each with a clear job; Fuel and Steel scarce, Manpower plentiful.
2. A readable counter web: Infantry → Artillery, Armour → Infantry, Anti-Tank/Air → Armour, Fighter/Anti-Air → Air.
3. Every nation has a doctrine (doc 02 §4) and 4–6 signature cards.
4. Neutral cards form the Starter Army and glue mixed decks together.

## 2. Starter Army (every new player)

30 cards, all Neutral commons, 60 points.

| Qty | Card | Type |
|---|---|---|
| 3 | Barracks | Building |
| 2 | Supply Depot | Building |
| 2 | Steel Mill | Building |
| 1 | Oil Derrick | Building |
| 5 | Rifle Squad | Unit |
| 4 | Light Tank | Unit |
| 3 | Mortar Team | Unit |
| 3 | Anti-Tank Gun | Unit |
| 3 | Field Medic | Unit |
| 2 | Reinforcements | Order |
| 1 | Forced March | Order |
| 1 | Smoke Screen | Order |

Players can sell any starter card for credit and build on the free market from there. The starter army must be good enough to beat Easy AI ~70% of the time and Normal AI ~45%.

## 3. Buildings (12)

| ID | Name | Nation | Rar | Cost | HP | Produces / Effect |
|---|---|---|---|---|---|---|
| B01 | Barracks | Neutral | C | 1 Su | 4 | +1 Mp |
| B02 | Steel Mill | Neutral | C | 2 Su | 5 | +1 St |
| B03 | Oil Derrick | Neutral | C | 2 Su | 3 | +1 Fu |
| B04 | Supply Depot | Neutral | C | 1 Mp | 4 | +1 Su |
| B05 | Bunker | Neutral | C | 2 St | 8 | **Guard**. Produces nothing. |
| B06 | Field Hospital | Neutral | U | 2 Su | 4 | End of your turn: heal 1 to a friendly unit. |
| B07 | Refinery | Neutral | U | 3 Su, 1 St | 4 | +2 Fu |
| B08 | Anti-Aircraft Battery | Neutral | U | 2 St, 1 Su | 4 | **AA 2** |
| B09 | Rail Yard | USSR | U | 2 Su, 1 St | 5 | +1 Su, +1 Mp |
| B10 | Radar Station | UK | R | 2 Su, 1 St | 3 | Your first Air unit each turn costs 1 less Fuel (min 1 total). |
| B11 | Motor Pool | USA | R | 3 Su, 2 St | 5 | +1 Fu, +1 St |
| B12 | Tankograd Works | USSR | L | 4 Su, 3 St | 8 | +2 St, +1 Mp. Armour units you deploy cost 1 less Steel (min 1). |

## 4. Units (39)

Format: cost · ATK/HP · keywords. Nation icon implies doctrine synergy, not deck restriction.

### Infantry (12)
| ID | Name | Nation | Rar | Cost | ATK/HP | Keywords / text |
|---|---|---|---|---|---|---|
| U01 | Rifle Squad | Neutral | C | 1 Mp | 2/2 | — |
| U02 | Conscript Platoon | USSR | C | 1 Mp | 1/1 | **Mass** |
| U03 | GI Rifle Squad | USA | C | 2 Mp | 3/3 | — |
| U04 | Tommy Section | UK | C | 2 Mp | 2/3 | **Dug In** |
| U05 | Grenadier Squad | Germany | C | 2 Mp | 3/2 | **Siege 2** |
| U06 | Imperial Infantry | Japan | C | 2 Mp | 3/2 | **Tenacity** |
| U07 | Marksman | UK | U | 2 Mp, 1 Su | 3/1 | **Precision** |
| U08 | Combat Engineer | USA | U | 2 Mp, 1 St | 2/3 | **Siege 2**. On deploy: destroy target enemy building with 2 HP or less. |
| U09 | Paratroopers | USA | U | 2 Mp, 1 Fu | 3/2 | **Blitz** |
| U10 | Shock Troops | Germany | U | 3 Mp | 4/3 | **Blitz** |
| U11 | Guards Rifle Division | USSR | R | 3 Mp, 1 Su | 4/5 | **Dug In**, **Rally** |
| U12 | Naval Landing Force | Japan | R | 3 Mp, 1 Su | 4/4 | **Blitz**, **Tenacity** |

### Armour (9)
| ID | Name | Nation | Rar | Cost | ATK/HP | Keywords |
|---|---|---|---|---|---|---|
| U13 | Light Tank | Neutral | C | 2 St, 1 Fu | 2/3 | **Armour 1** |
| U14 | Universal Carrier | UK | C | 1 St, 1 Fu | 2/2 | **Armour 1**, **Blitz** |
| U15 | Type 97 Chi-Ha | Japan | C | 2 St, 1 Fu | 2/3 | **Armour 1**, **Tenacity** |
| U16 | M4 Sherman | USA | U | 2 St, 1 Fu | 3/4 | **Armour 1** |
| U17 | T-34 | USSR | U | 2 St, 2 Fu | 3/3 | **Armour 2** |
| U18 | Panzer IV | Germany | U | 3 St, 1 Fu | 4/3 | **Armour 1**, **Piercing** |
| U19 | Churchill | UK | R | 3 St, 1 Fu | 2/6 | **Armour 3**, **Heavy** |
| U20 | Tiger I | Germany | R | 4 St, 2 Fu | 6/6 | **Armour 3**, **Piercing**, **Heavy** |
| U21 | IS-2 | USSR | L | 5 St, 2 Fu | 7/8 | **Armour 3**, **Piercing**, **Siege 3**, **Heavy** |

### Artillery and Anti-Tank (8)
| ID | Name | Nation | Rar | Cost | ATK/HP | Keywords |
|---|---|---|---|---|---|---|
| U22 | Mortar Team | Neutral | C | 1 Mp, 1 Su | 2/1 | **Ranged**, **Indirect** |
| U23 | Anti-Tank Gun | Neutral | C | 2 St, 1 Mp | 3/2 | **Ranged**, **Piercing** |
| U24 | 25-pounder | UK | U | 2 St, 1 Su | 3/2 | **Ranged**, **Indirect** |
| U25 | 105mm Howitzer | USA | U | 3 St, 1 Su | 4/2 | **Ranged**, **Indirect**, **Siege 2** |
| U26 | M10 Wolverine | USA | U | 3 St, 1 Fu | 3/3 | **Armour 1**, **Piercing** |
| U27 | Type 96 AA Gun | Japan | C | 2 St, 1 Su | 2/2 | **Ranged**, **Anti-Air** |
| U28 | 88mm Flak | Germany | R | 3 St, 1 Su | 4/3 | **Ranged**, **Piercing**, **Anti-Air** |
| U29 | Katyusha | USSR | R | 3 St, 2 Su | 3/1 | **Ranged**, **Indirect**, **Salvo** |

### Air (7)
All Air units have **Flying** and **Upkeep (Fuel 1)** unless noted.
| ID | Name | Nation | Rar | Cost | ATK/HP | Keywords |
|---|---|---|---|---|---|---|
| U30 | Bf 109 | Germany | C | 2 Fu | 3/1 | **Fighter** |
| U31 | Spitfire | UK | U | 2 Fu, 1 St | 3/2 | **Fighter** |
| U32 | Stuka | Germany | U | 2 Fu, 1 St | 3/2 | **Siege 3** |
| U33 | Il-2 Sturmovik | USSR | U | 2 Fu, 2 St | 3/4 | **Armour 1**, **Siege 2** |
| U34 | A6M Zero | Japan | R | 3 Fu | 4/2 | **Fighter**, **Blitz** |
| U35 | P-51 Mustang | USA | R | 3 Fu | 4/3 | **Fighter** |
| U36 | B-17 Flying Fortress | USA | L | 4 Fu, 2 St | 5/6 | **Siege 3**, **Upkeep (Fuel 2)** |

### Support (3)
| ID | Name | Nation | Rar | Cost | ATK/HP | Keywords / text |
|---|---|---|---|---|---|---|
| U37 | Field Medic | Neutral | C | 1 Mp, 1 Su | 1/2 | End of your turn: heal 1 to a friendly unit in this lane. |
| U38 | Field Radio Operator | UK | U | 1 Mp, 1 Su | 1/2 | Your first Order each turn costs 1 less Supplies (min 1 total). |
| U39 | Commissar | USSR | R | 2 Mp | 2/3 | **Rally**. Friendly units in this lane cannot be Suppressed. |

Totals: 12 Infantry, 9 Armour, 8 Artillery/Anti-Tank, 7 Air, 3 Support = 39 units. The first balance pass may cut or merge cards.

## 5. Orders (12)

| ID | Name | Nation | Rar | Cost | Effect |
|---|---|---|---|---|---|
| O01 | Air Raid | Neutral | C | 2 Su, 1 Fu | Deal 3 damage to target enemy unit or building. |
| O02 | Smoke Screen | Neutral | C | 1 Su | Choose a lane. Enemy Ranged units cannot attack into that lane until your next turn. |
| O03 | Reinforcements | Neutral | C | 2 Su | Draw 2 cards. |
| O04 | Forced March | Neutral | C | 1 Su | Target friendly unit gains **Blitz** this turn. |
| O05 | Dig In | Neutral | C | 1 Su, 1 St | Target friendly unit gains +2 HP (permanent). |
| O06 | Sabotage | Neutral | U | 2 Su | Destroy target enemy building with 4 HP or less. |
| O07 | Naval Bombardment | Neutral | U | 3 Su, 2 Fu | Deal 2 damage to every enemy Front unit. |
| O08 | Lend-Lease | USA | U | 2 Su | Gain 3 of one resource of your choice. |
| O09 | Scorched Earth | USSR | U | 1 Su | Destroy one of your own buildings. Deal 3 damage to every enemy unit in one lane. |
| O10 | Enigma Intercept | UK | R | 2 Su | Look at the opponent's hand. Choose a card; they discard it. |
| O11 | Blitzkrieg | Germany | R | 3 Su | Until end of turn, all your units gain **Blitz** and +1 ATK. |
| O12 | Operation Overlord | USA | L | 5 Su | Put up to three Infantry cards from your deck onto empty slots (any lanes). They are Fresh. Shuffle your deck. |

## 6. Mana-curve and resource targets

- Average card cost across a typical deck: 2.5 total resources.
- Typical resource spread in a mid-game deck: Mp 35%, St 25%, Fu 15%, Su 25%.
- A well-built deck reaches its first 3-building economy by turn 4.
- Fuel is the scarcest: any deck of 5+ Air/Armour units must run an Oil Derrick or Refinery.

## 7. Rarity totals (target)

| Rarity | Buildings | Units | Orders | Total |
|---|---|---|---|---|
| Common | 5 | 14 | 5 | 24 |
| Uncommon | 4 | 14 | 4 | 22 |
| Rare | 2 | 9 | 2 | 13 |
| Legendary | 1 | 2 | 1 | 4 |
| **Total** | 12 | 39 | 12 | 63 |

## 8. Nation signature cards

| Nation | Signature cards |
|---|---|
| USA | Motor Pool, Combat Engineer, 105mm Howitzer, P-51 Mustang, B-17, Operation Overlord |
| UK | Radar Station, Marksman, Churchill, Spitfire, Enigma Intercept |
| USSR | Rail Yard, Conscript Platoon, T-34, Katyusha, IS-2, Tankograd Works |
| Germany | Shock Troops, Panzer IV, Tiger I, 88mm Flak, Stuka, Blitzkrieg |
| Japan | Imperial Infantry, Naval Landing Force, Chi-Ha, Type 96 AA Gun, A6M Zero |

## 9. Known gaps and balance risks
- Japan has the thinnest signature list; consider an additional Order or Building.
- Tiger I / IS-2 may be too hard to answer; Anti-Tank cards and Dug In Infantry are the only checks. Test.
- Air may be too strong vs decks without Anti-Air. Starter Army includes none; consider adding AA Battery to the starter or lowering Air's Breakthrough.
- Mortar Team's Indirect plus Ranged for 2 resources may be oppressive.

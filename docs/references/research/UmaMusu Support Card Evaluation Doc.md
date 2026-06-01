#

# *Uma Musume: Pretty Derby*

# Support Card Evaluation Doc

By celery6305

**Introduction:** This document contains results of support card evaluation pulled from my own Support Card rating tool, aimed to give some idea of how cards rank in terms of stats gained.

The ratings are based on simulations with the most current meta scenario available in the JP version of the game, and evaluation parameters are also adjusted towards the JP meta.

The spreadsheet below has a release date filter you can use to make lists for older cards, but it’s pretty inaccurate for Global since the evaluations still use current scenario parameters for the JP meta which may not reflect the situation in the past very well. I may fiddle with this later.

To use the document, you may navigate directly to the sections for each card category which provide pictures that illustrate the score that each card has been given. After this there’s a writeup of further details for the most commonly used top cards.

See [Card Score Spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw) for a list overview.

In this document each card in the main sections is evaluated at **MLB**. See the spreadsheet above for non-MLB cards.

See also [Reroll recommendations](#rerolling-for-cards) and [SSR pick ticket recommendations](#ssr-pick-ticket-usage).

Current scenario parameters: **General (YHS)**

|                                         Current card meta (YHS): |  |
| ----- | :---: |
| ![][image1] | 1-2 used in all decks |
| ![][image2] | 1 used most of the time |
| ![][image3] | 1 used sometimes |
| ![][image4] | 1 used always |
| ![][image5] | 1 used always |

Race bonus recommendation: Not important. But **34% or more** gives a minor boost in stats
**Other guides by me:**

- Scenario gameplay guides: [YHS](https://docs.google.com/document/d/1Ud4JO6zlU9R1n9YjP13ORdWmFRab0o5_NLHIi5c_imY) [DYI](https://docs.google.com/document/d/1kmCbUtdQap3YtXnnGRrdk-_Di3pXaATnJBrPACPQcAc) [TL](https://docs.google.com/document/d/1v9w4Tr48Xh5mXWHSLGGUU_XEYY148t7wqPd9120QjBU) [Mecha](https://docs.google.com/document/d/1pOYzeqdeFJsDJT_HmXtfB7_S-I6D7AY_GYidXUNZsTI) [GFF](https://docs.google.com/document/d/1hBjeQ6J9SQVIOm5sfysy_G2L4ZNRC_ng_-aPZxFLlXg) [UAF](https://docs.google.com/document/d/1s4fKD7aLnZ0Y7toxAjmsuIjfYr0RAhmKF0ndYsCXebM/) [L’Arc](https://docs.google.com/document/d/19mJAzyljQrfTQz468yIY_1jIfhYdMTGCtFTLe-AKTvc/edit#heading=h.z64zq6esp2wx) [GM](https://docs.google.com/document/d/1fWc31yOOD-3SMJQQ-Mjsj1S9M9iaZoQVvy5OGJw6en4/edit#heading=h.2dg74hkf5y1)
- Gacha reviews: [Link](https://docs.google.com/document/d/10fLPmAxKHdpPB-iOhMJD3QQJP7HIk_kTH4iGSNnckTA)

**Useful links:**

- Gametora: [support card list](https://gametora.com/umamusume/supports) and [compare tool](https://gametora.com/umamusume/compare) are useful for viewing card details

### **Notes/FAQ**

- There is no “one true way” to judge the strength of support cards. These evaluations will use a collection of parameters (stat weights etc.) that are judged by me to be fairly reasonable to rank the cards in question based on general usefulness for attaining desirable stats for PvP.
- Overall, a card's strength is mainly composed of 1\) its power to raise its main stats through *friendship bonus*, *\+stat boosts*, *specialty rate*, and *initial bond.* 2\) cross-training, meaning how much it benefits other trainings where it shows up, the main components being *training bonus* and *motivation bonus*. Race bonus and event stats are also big contributors to how much other stats are raised by a card.
- Group/Friend cards are hard to compare with other cards and often involve complicated mechanics tied to different scenarios so you won’t find their evaluation here. Typically a scenario linked group/friend card is a must-use card in their respective scenario anyways, leaving no place for other group/friend cards in the deck. Friend-like cards such as Fuku Speed SSR are hard to compare well to other cards too, so you won’t find them in the main evaluation images.
- When picking cards for a deck, cards within 20-40 score should probably be considered practically equal and your choice should be based on the skills they give, as skills are more important for PvP anyways. Note also that you can “gain” skill points from hint discounts of skills you would buy anyway, making cards like Ramonu int SSR much better in reality.
- Race bonus breakpoints are **not** evaluated here because the effect of hitting important race bonus thresholds such as 34%RB is so big that it would skew the ranking. For example, if you are debating between a card that gives 5% RB and one that gives 10% RB, but the 10% RB card gets you over the 34% breakpoint, you should add around 25 score to that card compared to its ranking here.
- If a card is not found in the ranking, it’s probably due to me forgetting or it being too hard to evaluate due to a complicated unique or something.

### **Recent changes:**

- 15.7.2025: Made a decision about scenario mechanics simulation, read below. Current evaluation is still somewhat tentative, I will probably work on this later this week and make some slight adjustments but it won’t change the order of cards much.

**Scenario mechanics simulation update**

Since 15.7 (after the release of the Design Your Island scenario) I have decided to move from in-depth scenario mechanics simulation to a more general/lazier solution that does not attempt to accurately simulate all of the intricacies of the current scenario's mechanics but rather tries to give a more balanced evaluation. There will still be some fiddling with parameters like race stats/different scenario stat bonuses/current meta decks/etc for each new scenario though, so it's still going to be somewhat more relevant for the current scenario. This choice I've made has the following pluses/minuses:

 **\+** Less hassle for me to code, probably the least enjoyable part about updating to a new scenario for me tbh
 **\+** The evaluations will probably be more fair towards card viability in future scenarios
 **\+** Maybe slightly better for global players
 **\-** Does not accurately reflect some cards' strength with respect to scenario mechanics, for example if they add stronger link effects in the future. Also e.g. Pasa speed SSR is very good in DYI due to the \+all stats bonus but currently I don’t simulate this (not like you’d be using that card anyway in top meta decks though).

One other main reason is that the DYI scenario was overbuffed and gives too many stats, so card strength becomes a bit less meaningful anyway and you can basically make any decent cards work with normal RNG and should pick your deck by prioritizing skills instead (as has been the case for the last few years…).

For global players, note that you’re still so far behind in modern scenario mechanics such as faster bonding, free energy events, and most of all, scenario stat boosts that ramp up in a significant way towards the end of runs in modern scenarios, making junior/classic year less important. For example, cards like Sweep Tosho speed SSR are reasonable enough (compared to similar options) in the modern meta but struggle in URA/Aoharu/whatever due to low starting bond.

**About the author**

I write this and my other Uma Musume guides as a hobby for my own amusement, and while I try to be as objective and accurate as possible these are just one person's evaluations on the subject. The evaluations are mainly based on aiming to figure out what is ideal in terms of optimizing results in the PvP meta (on the JP version, which I play). If you disagree with some of the results, that means you're probably knowledgeable enough about the game that you don't need them anymore, and that's a good thing.

In terms of credentials, I've played daily since September 2021 and play purely for meta, with varying time investment. I'm undefeated in mid/long CM finals since June 2022 and have made it to the top 96 list in LoH once.
![][image6]
I am a low spender. Outside of gaming, I work as a research scientist in a STEM field.

### **How does the tool work**

It evaluates cards based on the average amount of stats they give when weighed against every possible combination of trainings they may land on (the weights are based on the probability of each such combination occurring). For example:

One situation could be that a speed card is rainbowing on speed, one card is absent, and four others are in wisdom. In this case, it is most likely that the “best training” would be wisdom and once the tool decides this (based on stat weights) the result of the wisdom training is multiplied by the probability of this particular situation occurring and after summing over this result over all situations, the number is multiplied by the number of turns (in fact, I simulate 6 different “phases” of training ranging from early bonding phase to late game, so this would be the number of turns in that phase). The results of other trainings are discarded since they were not chosen to be the best one.

Energy/fail rate is not simulated per se, but a certain amount of turns are reserved for resting/dating/objectives. Total energy gain from training and events is added up and affects score.

Scenario mechanics are also simulated to a reasonable extent, but since the best scenario usually changes every 4 months these are not fine tuned to an unreasonably detailed extent to maintain the authors' sanity. Stats from races and events also contribute to the total score. Initial bond affects the probability to rainbow in phases 2-3 somewhat. Race bonus gains have no rounding to avoid unwanted effects from race bonus breakpoints (in reality, breakpoints like 34%RB can be significant and may affect deck choice).

When comparing cards to each other, they are simulated with 5 other cards that are kept constant. These cards are picked to be fairly reasonable choices based on meta decks. This has some disadvantages for rating weaker cards, since they are rated based on performance in a deck with 5 strong cards. Basically, treat the results as slightly less accurate for weaker/low LB cards.

After looking at some results, I’d say the bonuses on cards that provide the highest increase for stats are (normalized to quantities what the game considers ”equal”):

1) Flat stat bonuses (especially speed bonus on speed cards). Speed bonus is very good since it works on 3 training categories. SP bonus is also amazing, and offset bonuses are decent.
2) Training bonus/Motivation bonus (MB divided by 5 is somewhat close to an equivalent TB)
3) Friendship bonus
4) Specialty rate (the initial \~35 specialty rate matters a good amount, but higher amounts than 50 or so quickly become less important)
5) Race bonus (L’Arc gives less stats from races)
6) Other bonuses like initial stats up etc.

# Speed Cards

![][image7]
Notes: **![][image8]**Still in Love is slightly better in practice than the other cards around her score because she gives more SP than them, and SP is generally more valuable than pure stats. This is already taken into account in the stat weighting, but I can’t crank the SP weight up even higher just for the sake of this one card.
For ![][image9]Palmer I assumed you buy 3 recoveries somewhat early to activate her unique bonus, but this is often not realistic as for shorter distances you don’t always even want to buy recoveries and some umas/decks have trouble getting hints for recoveries anyway. With no recoveries she’d be around ![][image10]Pasa SR level. She is also very much focused on speed which is not ideal in practice.

**For the rest of the speed cards, see the [spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw).**

**In-depth details for the top speed cards:**
![][image11] Tokai Teio: Very strong leader-specific card that gives a strong leader early speed boost and a choice of either a final leg skill or a mid distance accel for leaders.
**![][image12]** Almond Eye: Universal speed card with stronger bonuses and skills than previously released cards. Gives a choice of two gold skills out of four, either a pair of good mid distance leader skills or two universal speed skills.
![][image13] Admire Groove: Mid betweener specialized speed card, gives a nice accel gold for them and a general-use betweener gold skill as well.
**![][image14]** Still in Love: A well-rounded speed card which gives a strong mid distance gold skill, or a good but slightly unreliable gold skill for betweeners/chasers. Her bonuses are very skill point gain focused, which is ideal for making strong builds for all PvP.
![][image15] Rhein Kraft: Mile specialty speed card, particularly aimed for frontliners by giving two frontline-specific mile gold skills, including the accel skill High Voltage. Balanced stats.
![][image16] Dream Journey: Chaser-specialized speed card. Fairly rounded out bonuses, but only suitable for training chasers. Gives two chaser gold skills.
![][image17] Narita Brian: Very strong speed card for stats, but her skills are for leaders only so not suitable for all builds. Gives the long leader gold accel skill Monster, and a strong leader midleg skill that spends some stamina.
**![][image18]** Smart Falcon: Very strong runner-speciality card. Gives an opening leg accel gold for runners and a lot of good runner skills.
**![][image19]** Vivlos: Stacked bonuses all around with the kind of 2024-style powercreep the devs have been adding to cards recently. This card is a very universally useful speed card due to giving a gold version of the speed skill Hold Your Tail High, but her main benefit is in the high stat gains.
![][image20] Seeking The Pearl: Short distance backline focused speed card, not noteworthy.
**![][image21]** El Condor Pasa: Very loaded bonuses overall and her unique gives \+1 all stat bonus at 100 bond. Slightly lower race bonus, but a total of \+2 SP bonus from this card means she is good for skill point gains. Good skills due to her universal gold skill Arcline Professor. Also has a leader/betweener accel gold for a few tracks.
![][image22] Jungle Pocket: Provides very high bonuses all over, there’s not really anything this card is missing in particular. With 10 race bonus and 1 SP bonus, this card has amazing SP gain which is great for PvP. Unique gives \+3 speed bonus at max bond which makes it quite easy to cap speed. Mid/long/backline skills.
![][image23] Duramente: Incredibly high specialty rate at 120 and very good cross-training bonuses as well. Slightly lacking in the speed bonus/SP bonus department but her insane chain events make up for it. Also gives the gold skill Never Give Up which is an amazing general-use gold skill for every strategy and distance.
![][image24] Sakura Bakushin O: Short distance specialist card. Great for getting high speed with her (up to) \+3 speed bonus, but lacks a bit of cross-training bonuses compared to Maruzensky below her. Borrow her when you can afford to in your short distance runs.
![][image25] Maruzensky: Highest cross-training bonuses for speed cards in the entire game with her unique that gives 5% training bonus per level of training. Amazing card for highrolling good stats and a staple in all runner decks due to its strong runner hints and very strong gold skill Top Runner.
![][image26] Mejiro Dober: Mile backline card. She’s not particularly amazing for stats, but she is very frontloaded so she’s quite usable for beginners. Not really a notable pick otherwise.
![][image27] Mejiro Palmer: Very strong card for raising speed IF you can activate her unique bonus of buying 3 recoveries. As mentioned before, this is not usually possible so this card is overrated a lot here. But if you are able to buy 3 recoveries early and it doesn’t screw up your build, the high specialty rate gives very high speed gains overall. Also has 10 race bonus and 1 SP bonus, but no power bonus. Good long/runner skills.
![][image28] Marvelous Sunday: Just very high bonuses all around, coming with 15% training bonus at max bond as well as \+1 Speed/Power/SP bonus. In all regards very similar to Kitasan Black but she’s got \+1 Speed/SP bonus over Kitasan at the cost of lower specialty rate. One of the fewer speed cards giving a gold recovery, but overall too niche in terms of skills to see much use.
![][image29] Eishin Flash: Apart from the lack of race bonus, this card comes with great stats especially with its \+2 speed/power bonus and \+1 SP bonus (out of these, \+1 pow/+1 SP come at 80 bond from her unique). The lack of race bonus is not much of an issue in L’Arc. Comes with decent betweener skills but nothing too crazy enough to be sad about missing in most builds.
![][image30] Kitasan Black: Though lower ranked here, this used to be a staple in all decks due to its super consistent rainbows and universal skills such as the gold skill Arcline Professor. Still a great card for newer players.
![][image31] Taiki Shuttle: Just another solid card with almost every relevant bonus, such as 2 speed bonus, 1 power bonus, \+1 SP bonus, 10% training bonus and 5% race bonus. The bonuses aren’t quite big enough to bring her up higher in the ranking, but the fact that she gives strong skills for mile (Ruler of Mile as the gold skill) means that she can be used in mile frontliner builds.

**Honorable mentions:**
**![][image32]** Tosen Jordan (SR): Very good SR card.
![][image33] Agnes Tachyon: Used in leader builds.
![][image34] El Condor Pasa (SR): Strong card with \+1 spd/pow bonus. ![][image35] Shinko Windy and ![][image36] Sweep Tosho are fine alternatives as well.

# Stamina Cards

![][image37]

Notes: Stamina card ranking is a bit weird because stamina cards have various use cases depending on what distance you are building for. A longer distance build will need to emphasize pure stamina gain, while a shorter distance mid build might want to use a stamina card with higher cross-training bonuses.

![][image38]Mayano has 0 starting bond so might be a bit lower in reality. ![][image39]Palmer was assumed to have 15% training bonus. For ![][image40]Laurel, I assumed you buy 3 recoveries fairly early (year 1-2) even though this is not usually realistic. ![][image41]Ikuno has 0 specialty rate but has higher bonuses elsewhere especially with her high cross-training and race bonuses. In practice she might be annoying to use due to the inconsistency though, so unless highrolling I recommend creek/dia/cafe instead. ![][image42]Tamamo is quite similar but with lower stats.

**For the rest of the stamina cards, see the [spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw).**
**In-depth details for the top stamina cards:**

![][image43] Fenomeno: Long leader stamina card. Gives both a long random accel gold for leaders and a late midleg gold skill.
![][image44] Inari One: Long betweener stamina card. Gives both a long accel gold for betweeners and a midleg gold skill.
![][image45] Gold Ship: Long chaser stamina card. Gives the chaser accel skill Imminent Shadow and a gold heal for chasers.
![][image46] Air Shakur: Universally strong stamina card which has a very strong statline overall, but is further enhanced by her scenario link effect. Gives a very good universal recovery+speed skill or a current speed skill for the final leg that works unless you’re at the front of the pack.
![][image47] Mejiro Ryan: Mid betweener stamina card. Strong at low LB’s already, and gives a mid distance betweener midleg gold from the first chain event.
![][image48] Sounds of Earth: All around the second best stamina card at the moment. Good cross training, good stamina gain, and very high SP gain. Gives a gold recovery skill or a gold speed skill as the choices.
![][image49] Curren Bouquetd’or: Leader-specialty stamina card with a gold heal. Nothing too noteworthy.
![][image50] Duramente: Chaser-specific stamina card with two chaser midleg gold skills.
![][image51] Tanino Gimlet: Very high cross-training bonuses and especially good for guts training. This card is particularly specialized towards mid distance training as it lacks stamina bonus and has low friendship bonus. Gives some nice mid distance skills and a gold skill for mid backliners.
![][image52] Dantsu Flame: Basically the frontline version of Gimlet SSR. Mid distance oriented and gives a strong gold skill for mid frontliners.
![][image53] Hokko Tarumae: Good stats all around and great skills for dirt races. Can find a spot in most mid dirt builds, but otherwise no need to bring this card.
![][image54] Ikuno Dictus: Gets ranked very high due to its amazing cross-training (unique gives up to 20% training bonus) and race bonus. Not very consistent though as it lacks specialty rate, and the gold skill is a betweener skill that is very strong but drains a bunch of stamina, so it has limited uses. Great for getting lucky highrolls though, which is often ideal for PvP builds.
![][image55] Super Creek: One of the older cards that are still great to this day. Just great bonuses all around with 15% training bonus and 10% race bonus as well. Gives the gold recovery Arc Maestro which works universally, making her a fine option when you really need to survive a high stamina requirement.
![][image56] Satono Diamond: Fairly similar to Creek but gives higher gains in guts. The recovery skill it gives isn’t as consistent, so this doesn’t see too much use.

**Honorable mentions:**
![][image57] Mejiro Mcqueen: Lower than Creek in ranking, but her skills are much better for long distance races. If you can stand the loss in stats, this gives higher potential in long PvP.
![][image58] Mejiro Palmer: One of the only cards that give the runner opening leg accel gold, making her useful in specific runner builds for umas that lack this as an innate skill.
![][image59] Symboli Kris S: Gives a long distance accel gold for betweeners, which is a requirement to make a strong betweener build in long distance. Mostly replaced by Manhattan Cafe int.
![][image60] Special Week: Gives Nonstop Girl as a gold skill, this is a very strong accel skill for most mid/long tracks for non-runners.
![][image61] Yaeno Muteki (SR): Very strong stamina SR card.
![][image62] Mayano Top Gun (SR): Starts at 0 bond, but her high bonuses overall make her a decent choice for highrolling.

# Power Cards

Power card ranking is a bit weird because power as a category kind of sucks for getting high scores, you’re more inclined to click on it during training just out of necessity since power is a very good stat.
![][image63]
Notes: There’s another reason to be suspicious of pure stat ranking for power cards, since some power cards are intended to also work for longer distance builds and come with stamina raising bonuses. For shorter distances, stamina is less important of a stat so if you’re picking a power card to use you should take note of their actual bonuses and skills rather than just score.

![][image64]Agnes Digital’s (SSR) unique bonus requires 5 cards of different categories, which is not actually true for the simulation but I assumed it to hold to be more fair to the card. ![][image65]Biko has that odd unique bonus of gaining training bonus based on your maximum energy threshold, which changes based on your deck and scenario.
 ![][image66] Haru Urara is not added anywhere due to its unique being annoying to add, but this card is worthless anyways.

**For the rest of the power cards, see the [spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw).**
**In-depth details for the top power cards:**
![][image67]Tamamo Cross: Power card intended for mid/long and backline builds. Especially useful in the Design Your Island scenario. Gives a gold skill choice of Divine Speed (universal speed boost) \+ either a midleg mid/long speed boost or a backline midleg speed boost.
![][image68]Vodka: Mid betweener power card. Very strong in pure stats and raising power high, though only \+1 SP bonus. Gives two gold skills (one betweener, one mid).
![][image69]Mejiro Ardan: Very desirable card to have in your deck for the \+2 SP bonus and overall strong statline. Specializes towards leaders and mile/mid frontline in general though, lacks in the skill department for backliners unless the meta is very backline-heavy.
**![][image70]** Nishino Flower: Mostly a generic-use power card with very strong stats. She is the first card who can gain up to 30% training bonus in total. Gives a choice of a short/mile gold skill and a generic midleg gold skill for frontliners.
![][image71] KS Miracle: Very balanced stats overall, and specializes as a short-distance power card.
**![][image72]** Seiun Sky: Mid distance runner specialist power card. Quite high stat gain overall, notably with \+2 stamina bonus, but she’s very limited in her use cases and isn’t suited as a general-use power card. Close to Nishino Flower in evaluation but much lower in practice since stamina is less important when you’re usually bringing power cards.
![][image73] Espoir City: Dirt specialized power card with a bunch of stamina bonus (2024 version of Acute power). Both gold skills are good, a speed green and a recovery+speed skill, but only good for like, dirt mid events.
**![][image74]** Winning Ticket: Good power card for betweeners, and doesn’t need much limit breaks if you care purely about stats. The gold skill is a strong final leg betweener skill.
**![][image75]** Tsurumaru Tsuyoshi: Pretty good card in terms of overall stat gain and for gaining high power with its \+2 power bonus. However, the skills on this card aren’t really amazing enough where you’d be happy about including it in a meta where power cards aren’t doing so hot.
![][image76] Wonder Acute: Dirt race specialist power card, but not as strong for shorter distances due to her \+2 stamina bonus.
![][image77] Vodka: Bonuses are strictly optimized towards gaining high power stat and lot’s of power rainbows. This is very good when we rank cards based on power gain, but less good for raising other stats. Also gives a universal gold recovery skill, making her a possible option for longer distance builds.
![][image78] El Condor Pasa: An older card that has stood the test of time with its high bonuses, especially the 10% race bonus. Gives the gold skill Killer Tune, which is a great mid distance skill for runner/leader. Can’t be used together with speed Pasa though, so it’s a bit sad.
![][image79] Hishi Amazon: Strong in terms of cross-training but not as good at raising power itself. Her main use case is to get the gold version of straight shot for chasers that don’t have it built in, and she does it pretty well with maximum discounts on a few good chaser skill hints.
![][image80] Mayano Top Gun: Similar bonuses to Pasa, but not as high race bonus though she does give SP bonus instead. Just a solid card and gives the gold skill Nonstop Girl which makes her acceptable for some mid/long builds.
![][image81] Admire Vega: Decent cross-training bonus at 20% training bonus and comes with 10% race bonus as well. Gives the amazing chaser gold skill Daring Attack.

**Honorable mentions:**
![][image82] Daiichi Ruby: Weak card with a short/mile gold skill for backliners. Decent for building debuffers.

#

# Guts Cards

![][image83]
Notes: Overall, guts isn’t the most important stat to pad to high amounts, so you’ll mostly pick a card based on the skills it gives. ![][image84]Urara is the go-to card for newbies, since she’s free and gives good stats (at the cost of not giving any good skills and having to mald with her low starting bond).

**For the rest of the guts cards, see the [spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw).**
**In-depth details for the top guts cards:**
**![][image85]** Stay Gold: Universal guts card with decent stats. Slightly lacking in cross-training compared to some other cards on this list, but makes up for it by having a really useful spread of skills including two good golds.
**![][image86]** Fine Motion: Really good stats overall, basically the 2024 version of Urara guts. However, this card has a big issue in the fact that the gold skill is only useful for mid distance frontlines, and basically only really viable in exactly 2000m races. Since this card is so niche, most of the time you’d rather use another guts card unless you’re just training to pad score.
![][image87] Hishi Amazon: Chaser specialized guts card. Gives a generically good chaser gold skill. Good card but quite niche uses.
**![][image88]** Orfevre: Very strong compared to previously released guts cards, with a unique effect of gaining \+1 stat bonus at 80 bond for every type of card in your deck, so in a 2 speed/2 guts/1 int/1 friend deck that would be \+2 speed \+2 guts \+1 int \+ 1 skill points. Gives a really good general-use gold skill, Divine Speed, and overall very usable anywhere you’d need a guts card.
![][image89] Silence Suzuka: Runner guts card that gives a generic runner speed gold or a mid distance accel for some tracks.
![][image90] Curren Chan: Not up to top cards in stat gain, but her skills are amazing for building short-distance frontliners. Gives Concentration or a leader short accel.
![][image91] Blast Onepiece: Another leader specialist guts card. Decent skills, but doesn’t stand out that much otherwise.
![][image92] Fuji Kiseki: Leader specialist guts card. If you’re trying to fit in a second guts card in your leader decks and aren’t hard-pressed to any option in particular, this card is always good.
![][image93] Haru Urara: Love it or hate it, this welfare card has absolutely stacked bonuses across the board except for its lack of initial bond. With amazing cross-training, 10 race bonus, and high friendship bonus, she is great for highrolling big stats. Also has \+1 SP bonus. But the lack of good skills and her low initial bond make her occasionally grief your training completely due to not bonding up. Still, the best welfare card ever printed.
![][image94] King Halo: Great card for training short distance backliners due to the gold skills it gives. This card is fairly highly rated here since it has pretty good total stat gain, but a lot of it is focused on speed since this card has up to \+3 speed bonus. It’s also decent at raising guts with \+2 guts bonus, but perhaps a bit lacking in offstat gains.
![][image95] Tap Dance City: A premium guts card for runner training. Lacks hint bonuses, but quite potent at getting high stats otherwise. Unique bonus gains training bonus per speed skill bought, up to 3 skills total. Both Runaway and Escape Artist are available from this card as gold skills, and are good skills for runners.
![][image96] Gold City: A really strong card for raising guts in particular with her \+3 guts bonus at max bond. Her high starting bond helps a lot with this, and \+1 power bonus is also very desirable for a guts card. Not as high cross-training and race bonus. Gives really good mile skills and a choice between a summer speed green gold and a very good mile accel gold skill mainly for frontliners.
![][image97] Symboli Rudolf: Just a card with really solid bonuses all around, especially 2 speed, 1 power, and 2 guts bonus. Gives Arc Maestro as a universal gold recovery skill, which means that she is more suited towards mid distance builds and therefore less commonly used.
![][image98] Ikuno Dictus: Notable for her 15% race bonus and very strong events. Gives a lot of stamina, so don’t overrate this card due to its high placement since stamina is often not as important in short/mile where guts cards see more play. Gold skill is useless too outside of stadium PvP.
![][image99] KS Miracle: A staple in short/mile leader builds, her \+2 power bonus and overall good stats also get her high up in this evaluation. The leader accel gold she gives is almost a necessity in leader builds for shorter distances.

**Honorable mentions:**

![][image100] Ines Fujin: An older card that is still very good. Consistent guts rainbows and good cross-training, but quite outdated events. Hints are good all around, and the gold is a good recovery skill for runners that works on most tracks.
![][image101] Winning Ticket: Not very strong for raising stats, but gives the betweener accel skill Switch-Up Pro which is great for short/mile builds. Quite usable at lower LB’s already.
![][image102] Admire Vega: Ranked as the highest SR here due to the 15% race bonus it has got being very strong, but honestly the other SR cards seen above are pretty good too. Judge by what your deck needs the most if you end up choosing between them.

#

# Wisdom Cards

![][image103]
Notes: ![][image104]Ikuno has a bunch of speed bonus, which makes her not as good for pure stat chasing unless you’re running 1 speed card or something, but she does give good skill hints for mile. Overall, int cards should be mainly chosen based on their skills (like most card types nowadays), since the stat differences between the top cards are negligible.

**For the rest of the wisdom cards, see the [spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw).**
**In-depth details for the top wisdom cards:**
![][image105] Daring Tact: Betweener-specialty int card with very strong stat gain, especially in rainbows and skill point bonus (+2). Gives two betweener gold skills at once.
![][image106] Win Variation: Long distance int card that works well on all strategies, gives two long distance skills at once.
![][image107] Symboli Rudolf: Very rounded out int card in terms of stats, and gives a really good selection of skills including a universal gold skill (slipstream gold) and as another option the leader/betweener specialty accel skill Oute which works on a select few tracks.
![][image108] Daring Heart: Mile frontline specialized int card with generically decent stats.
**![][image109]** Mejiro Mcqueen: Great card for pure int training with up to \+3 int bonus, 80 specialty, decent cross-training and \+1 speed/SP bonus as well. Can’t really go wrong with this card in terms of stats but the skills are leader only. They are very good leader skills though, especially the gold skill which is midleg speed.
![][image110] Daiwa Scarlet: Runner-specialty int card with solid stats and even better skills with up to max hint level. Gives the essential runner skill Top Runner or a long distance instant accel for runners, so mandatory to make a lot of runners work in long distance.
![][image111] Copano Rickey: Dirt specialist card which has a lot of dirt-only skills that are unobtainable anywhere else. Her two gold skills are frontline-oriented, coming with either a speed skill or a gold heal.
![][image112] Narita Taishin: Chaser specialist card with very good cross-training bonuses and great SP gain. Meta for all chaser builds for all distances, but not really worth using otherwise.
![][image113] Ikuno Dictus: Mile specialized card with a bunch of speed bonus.
![][image114] Taiki Shuttle: Default option for mile frontline builds, since her gold is a very strong option for those. Bit stacked on speed bonus, so not as easy to raise int as the top cards.
![][image115] Neo Universe: Bit of a forgettable card since her gold skill is a mid random accel which is quite bad. Decent for parenting.
**![][image116]** Manhattan Cafe: Comes with all-around premium bonuses like 15% training bonus, 40% motivation bonus, and 10% race bonus in addition to \+2 int and \+1 SP at 100 bond. Strongest cross-training bonuses out of any int card at the moment. Skills are mainly for long distance and especially a crucial card for all long distance betweeners.
![][image117] Mejiro Ramonu: Very strong bonuses all around, especially the 35% friendship bonus and \+2 int bonus mean that her int rainbows are very fat. Her unique bonus gives 4% training bonus for every speed skill obtained (uniques that give speed count as one too), up to 20% training bonus. She also gives maximum discounted hints for some very strong mile/mid skills, which means that in practice she is even more highly rated than just this purely stat-based evaluation. Gold skill is a strong mile/mid skill. Might not be number one in this ranking, but still the best int card to own due to her universality in mile/mid.
![][image118] Mihono Bourbon: Very high bonuses across the board except for the lack of race bonus which is not a big issue in L’Arc. Her unique gives \+60 initial stats total distributed based on the categories of the cards in your deck. This somewhat makes up for a lack of race bonus, but since she does not have an SP bonus either this means that her SP gain is limited. Gives good skills for runners though, gold being the gold version of the opening leg accel Groundwork.
![][image119] Nakayama Festa: Very focused on int training with her 80 specialty, but also reasonably decent cross training bonuses. Lacks race bonus but makes up for it with her frequent int rainbows and strong events. Gives the gold version of right turns green, solid skill for all right turns tracks.
![][image120] TM Opera O: Quite similar bonuses to Ramonu, but has \+2 speed bonus instead of SP bonus and increased friendship bonus. Very good for raising speed and cross-training. Great hints for long distance, and the gold skill Monster is a meta-defining skill for long distance leader builds. Also gives an option to choose a generic straight speed gold instead.
![][image121] Satono Diamond: Very solid and balanced statline. Gives good skill choices for betweeners but she doesn’t otherwise stick out in particular.
![][image122] Aston Machan: Her 65 specialty is quite high for a wisdom card, and her unique bonus gives \+60% motivation bonus when she lands on a rainbow training, which together with her 15% training bonus makes her very potent in showing up in other trainings as well. Gives great skills for short distance, and the gold skill Concentration is a staple in many runner builds, sometimes leader as well.
![][image123] Fine Motion: Used to be the go-to wisdom card in the early days of the game, but has fallen out of builds due to powercreep especially in gold skill strength. The leader skill she gives isn’t too amazing.
![][image124] Nice Nature: An older card, but still has some solid bonuses especially as the only card here with 15% race bonus. Gives the betweener accel Switch-Up Pro as a gold skill which is a very strong option in short/mile builds.
![][image125] Mr. CB: An old staple in chaser builds due to the very strong chaser gold skill Daring Attack it gives. Notorious for being decent at 1LB already.

#

# Non-MLB cards

Consult the [Card Score Spreadsheet](https://docs.google.com/spreadsheets/d/17nbTcHUPqq8O6h_4Z6cVXwfkgEbpgO1VHzdLf-3YSfw) for checking out how cards compare at different limit breaks. If you want to apply filters atm you’ll have to make a copy of the sheet.

![][image126]

These simulations use the same parameters as the simulations for each card type from before. Please keep in mind the same special notes as before as well, such as:

- Palmer speed/Laurel stam/Digital SSR pow/… \<- cards like this have weird uniques which I evaluate very generously, but if you actually want to use them in a deck it is quite situational whether they’re good or not. If you can’t activate the unique, probably not.

- Some cards have 0 bond or 0 specialty, and the scoring given by the tool may not perfectly represent your idea of how strong they really are. It’s a challenge to evaluate such cards: Is a speed card that sucks at raising speed a good speed card if it’s good at raising other stats instead? Is a card that sometimes costs you a run due to low bond still a good card? The answers will depend on the person.

- Note also that the free welfare cards are only evaluated from 2LB to MLB, since their unique bonus activates at 2LB for some reason instead of 0LB like other cards. Basically, don’t use welfare cards at 0LB/1LB since they’ll be much worse.

###

# Friend/Group cards

Although there are many friend cards and group cards in the game, there is usually no need to compare them with each other.

Most of the time, running two friend/group cards together is not viable. However, most of the recent scenarios have a specialty friend/group card which synergizes especially well with the scenario mechanics:

| Scenario | Specialty card | Necessity |
| :---- | :---- | :---- |
| URA | \- | \- |
| Aoharu | Kashimoto Riko ![][image127] | Not required |
| Grand Live | Light Hello ![][image128] | Necessary |
| Grand Masters | 3 Goddesses ![][image129] | Necessary |
| Project L’Arc | Satake Mei ![][image130] | Necessary |
| U.A.F. Ready Go\! | Tsurugi Ryoka ![][image131] | Necessary |
| Great Food Festival | Akikawa Yayoi ![][image132] | Necessary |
| Mecha Umamusume | **No specialty card. You are free\!\!\!** | \- |
| Twinkle Legends | 3 Legends **![][image133]** | Necessary |
| Design Your Island | Tucker Brine ![][image134] | Necessary (3LB+) |
| Yukoma Hot Springs | Hoshina Kiyoko ![][image135] | Necessary |

These scenario-specific cards are pretty much must-includes in their respective scenario and therefore leave no room for other friend/group cards.

TLDR: Use a scenario-specific friend/group card if there exists one, don’t use the other friend/group cards unless you have a very good reason to do so.

#

# Recommendations:

## Rerolling for cards {#rerolling-for-cards}

For new players who just started playing, it is recommended to spend your initial jewels to reroll for certain cards. This means creating accounts (on the mobile client/emulator) until you get one that has a desired set of cards. Not having decent support cards to begin with can make your life a pain in the first month or so (later, too\!), and no event in the game offers better rewards per time invested than what rerolling has the potential to offer since it is quite fast.

Cards get stronger as you get more copies (up to 5 copies total including the first one), as these allow you to limit break them. Generally, max limit broken (MLB) cards of SR quality are better than SSR cards without limit breaks. But the strongest cards in the game are SSR cards, and some of them are already good at low limit breaks (this is more of an exception than a rule).

It is generally recommended to try to get some strong speed cards or wisdom cards to start off with, as these are used in almost all builds unlike other card types. Here I’ve compiled a collection of speed/wisdom SSR cards that are good targets for rerolling since they are already very strong at 0-1 limit breaks:

| ![][image136] | Speed  |     ![][image137]![][image138]![][image139]![][image140]![][image141] |
| :---: | :---: | :---- |
| ![][image142] | Wisdom  |  **![][image143]![][image144]![][image145]![][image146]**![][image147] |

Ideally, you aim for 1 speed card from here and hopefully you can either get 1\) another card from this list or 2\) some decent SR speed cards as well. A start with some decent speed SR cards \+ some other good SSR card or two can be very good as well. Getting multiple copies of a single card from here is very good, but rare. There are also some other cards which are decent at 1+ copies, consult the spreadsheet for details.

Note that it is much better to reroll when a strong card is featured in the current banner, even more so during free roll periods (so you can roll more at once). Usually, free rolls are during: Anniversary (end of February), Half-anniversary (end of August), New Years (beginning of January).

Getting a card that is not featured is quite rare, and for the featured cards you have a good chance of obtaining multiple copies of them if you try enough. If the featured card is good and you’ve decided to invest in it, you should be able to get enough gems from just playing the game for a few days to spark the banner (200 rolls for \+1 free featured card) after the initial reroll to get even more copies, ideally to MLB.

###

## SSR pick ticket usage {#ssr-pick-ticket-usage}

Sometimes a mission or shop will have a SSR pick ticket you can use to choose one SSR card from a pool of past SSR cards to add into your collection. For these tickets, the general rules are that:

- You should use it to try to get a meta card to high LB’s. As you can see from the spreadsheet, 0LB-1LB SSR cards are rarely much stronger than SR’s. But if you stack enough tickets or already have a good SSR at 2LB/3LB, you can use the ticket to obtain a top tier card at MLB. This is the best idea 90% of the time.
- Use the above ranking to roughly judge how strong a card is. Remember that cards which are only 20-30 score apart aren’t that much different from each other, so you’ll want to pick cards not only based on stats but also their skills (very important). Meta cards are usually meta because they give both good stats and skills.
- Pick a card that fills out your current roster. If you’re lacking good cards the order of operations should generally be Speed \-\> Wisdom \-\> Stam/Guts in terms of which cards to invest in first. So if your speed cards are good, start looking at wisdom cards etc.
- If it’s during a major patch like the release of a new scenario, wait for the meta to settle before making any hasty decisions.
- Remember, you can always save the ticket for later. They don’t expire.



## Welfare card choice item

This section is about cards you can pick for free from the welfare card selector:

(This item is obtained from monthly story events.)

Here are notably good event welfare cards with some info on why/when you should pick them. Cards not mentioned here are whatever. Note that cards get added to the selection pool a number of months after their event, so all story event welfares will eventually end up selectable.

In principle, just pick whatever you need the most at the moment. If your speed cards are lacking, pick speed. If you need a stamina card for a mid/long event, pick stamina. Otherwise probably int \> guts \>\>\>\> power.

![][image1] **Speed cards:** Probably your first choice.
![][image148] Special Week: One of your first choices if you’re missing speed cards. The leader recovery she gives can be useful for mid/long builds.
![][image149] Fine Motion: Very similar to Spe. You could argue she gives better hints so she could be the better pick if you don’t own her already.
![][image150] Tosen Jordan: You probably won’t need to pick her since Spe/FM exist, but she does give a universal gold recovery so could be an option if you really need a gold recovery for other strategies than leader.
![][image3]**Stamina cards:** Might need to pick a stamina card to save your ass in a long distance PvP event.
![][image151] Biwa Hayahide: The top choice when it comes to stamina welfares because she gives a universal recovery for long distance. Zenno Rob Roy gives slightly higher stats but a bad gold skill. Since neither is a card you’d be very happy about having to use in the first place, I’d say Biwa is more likely going to be useful since gold recoveries can be very important for long tracks.
![][image152] Twin Turbo: Similar to Biwa in stats but provides the crucial runner skill Top Runner. If you’re a new player without access to Maruzensky SSR but want to build runners, then maybe this card will help you out sometimes. It’s not a card you’d love to use normally though.
![][image4] **Power cards:** None of these are particularly useful.
![][image5] **Guts cards:** Urara and Spe (the main story welfare guts card) are strong enough that you probably won’t need these.
![][image153] Matikanetannhauser: Pretty strong on paper but she shares the same 0 bond issue as Urara guts, and you probably don’t want two such cards in the deck. So just use Urara instead.
![][image154] Yukino Bijin: Decent if you need Curve Sommelier for whatever reason, otherwise don’t bother too much.
![][image155] Mejiro Ryan: Fine for stats too, but lacks good skills unless you’re training for stadium or something.
![][image2] **Wisdom cards:** You’ll mostly be fine with SR cards, but Helios is good.
![][image156] Daitaku Helios: Actually very good compared to the other int welfares. Gives short skills and a useless gold skill, but the stat gain is good.
![][image157] Mihono Bourbon: If you’re dead set on making a runner build work, you might need her gold skill as it’s a strong opening leg accel. But she’s very much sidelined by her gacha SSR and not that good for raising int, so it’s not a pleasant situation to be in.

## Support card shop

The training pass introduced on the 3rd anniversary introduces a new currency: ![][image158]

This can be used to buy some older cards from a shop. These are mostly useless for long-time players, but new players can pick up some decent cards here. Order of priority should be:

**Speed**
![][image22] Jungle Pocket is the standout option here, with much stronger stats than previous cards in the shop.
Maruzensky is a very good option here, giving good runner skills with strong stat gain.
Kitasan Black is the another good option here, but does want 3LB-MLB.
Biko Pegasus is similar in strength but less useful.
Mayano Top Gun is good if you need a gold recovery for runners in longer distances, otherwise worse than Kitasan.

**Stamina**
Super Creek is the best option here by far, and works for most of your stamina card needs.

**Power**
Admire Vega and Vodka are both great options. Rice Shower if you’re coping for a gold recovery.

**Guts**
Ines Fujin is the most useful one here.

**Wisdom**
![][image120] TM Opera O is a decently strong card especially for long distance leader builds. Fine Motion/Mr. CB are the next best options.

import json

from horsetrader.pipeline import Pipeline
from horsetrader.models.events import Banners

if __name__ == "__main__":
    Pipeline().run()
    print(json.dumps(Pipeline().metrics, indent=2))

    banner = Banners().search("30010-banner")[0]

    from pprint import pprint

    pprint(banner)

# Banner(key='30010-banner',
#        correlations={'gametora': 30010},
#        references=References(["'https://gametora.com/umamusume/gacha/history?server=ja&year=all&type=all'", "PosixPath('/home/kris/code/horsetrader/etl/global/en.banners.yaml')"]),
#        periods=[Period(start=2021-03-30 12:00:00+09:00, span=16 days, 0:00:00),
#                 Period(start=2025-07-16 22:00:00+00:00, span=16 days, 0:00:00)],
#        type=<BannerType.TRAINEE: 'Trainee Gacha'>,
#        contents=[Trainee(key='100302-tokai-teio',
#                          correlations={'gametora': 100302},
#                          references=References(["'https://gametora.com/ja/umamusume/characters'", "'https://gametora.com/ja/umamusume/characters/100302-tokai-teio'", "'https://gametora.com/images/umamusume/characters/thumb/chara_stand_1003_100302.png'", "'https://gametora.com/images/umamusume/characters/chara_stand_1003_100302.png'", "'https://umapyoi.net/api/v1/outfit/character/1003'"]),
#                          character=Character(key='tokai-teio',
#                                              correlations={'gametora': 1003,
#                                                            'umapyoi': 1003},
#                                              references=References(["'https://gametora.com/ja/umamusume/characters/profiles'", "'https://gametora.com/ja/umamusume/characters/tokai-teio'", "'https://gametora.com/images/umamusume/characters/icons/chr_icon_1003.png'", "'https://media.gametora.com/umamusume/characters/profile/1003.png'", "'https://umapyoi.net/api/v1/character/1003'", "'https://umapyoi.net/api/v1/character/list'", "'https://umapyoi.net/api/v1/character'"]),
#                                              name=Japlish('トウカイテイオー', encoding='jp', en='Tokai Teio'),
#                                              three_sizes=ThreeSizes(bust=77,
#                                                                     waist=54,
#                                                                     hips=76),
#                                              icon=Image(url='/img/characters/tokai-teio_icon.webp', size=256x256),
#                                              portrait=Image(url='/img/characters/tokai-teio_portrait.webp', size=512x512),
#                                              quote=Japlish('無敵でキュート！天真爛漫ホッピン少女', encoding='jp', en="Heya, I'm Tokai Teio! I'm going to be an undefeated Triple Crown Umamusume, so don't let me out of your sight!")),
#                          release=Period(start=2021-03-30 12:00:00+09:00, span=0:00:00),
#                          variant=TraineeVariant(variant=<CostumeVariants.ANIME_COLLAB: 'anime-collab'>,
#                                                 title=Japlish('アニメコラボ', encoding='jp', en='[Beyond the Horizon]'),
#                                                 rarity=3),
#                          thumbnail=Image(url='/img/trainees/100302-tokai-teio_thumbnail.webp', size=128x128),
#                          portrait=Image(url='/img/trainees/100302-tokai-teio_portrait.webp', size=512x512)),
#                  Trainee(key='101302-mejiro-mcqueen',
#                          correlations={'gametora': 101302},
#                          references=References(["'https://gametora.com/ja/umamusume/characters'", "'https://gametora.com/ja/umamusume/characters/101302-mejiro-mcqueen'", "'https://gametora.com/images/umamusume/characters/thumb/chara_stand_1013_101302.png'", "'https://gametora.com/images/umamusume/characters/chara_stand_1013_101302.png'", "'https://umapyoi.net/api/v1/outfit/character/1013'"]),
#                          character=Character(key='mejiro-mcqueen',
#                                              correlations={'gametora': 1013,
#                                                            'umapyoi': 1013},
#                                              references=References(["'https://gametora.com/ja/umamusume/characters/profiles'", "'https://gametora.com/ja/umamusume/characters/mejiro-mcqueen'", "'https://gametora.com/images/umamusume/characters/icons/chr_icon_1013.png'", "'https://media.gametora.com/umamusume/characters/profile/1013.png'", "'https://umapyoi.net/api/v1/character/1013'", "'https://umapyoi.net/api/v1/character/list'", "'https://umapyoi.net/api/v1/character'"]),
#                                              name=Japlish('メジロマックイーン', encoding='jp', en='Mejiro McQueen'),
#                                              three_sizes=ThreeSizes(bust=71,
#                                                                     waist=54,
#                                                                     hips=76),
#                                              icon=Image(url='/img/characters/mejiro-mcqueen_icon.webp', size=256x256),
#                                              portrait=Image(url='/img/characters/mejiro-mcqueen_portrait.webp', size=512x512),
#                                              quote=Japlish('名門メジロ家の至宝。優雅で一途なお嬢様', encoding='jp', en='My name is Mejiro McQueen. Conquering the "Spring Tennosho" has been a long-cherished goal of the Mejiro family, and I will do it with my own two legs.')),
#                          release=Period(start=2021-03-30 12:00:00+09:00, span=0:00:00),
#                          variant=TraineeVariant(variant=<CostumeVariants.ANIME_COLLAB: 'anime-collab'>,
#                                                 title=Japlish('アニメコラボ', encoding='jp', en='[End of Sky]'),
#                                                 rarity=3),
#                          thumbnail=Image(url='/img/trainees/101302-mejiro-mcqueen_thumbnail.webp', size=128x128),
#                          portrait=Image(url='/img/trainees/101302-mejiro-mcqueen_portrait.webp', size=512x512))])

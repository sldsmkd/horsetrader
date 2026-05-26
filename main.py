from horsetrader.models.entities import Characters

if __name__ == "__main__":

    characters = Characters()
    print(len(characters.characters()))
    print(characters.character("agnes-digital"))

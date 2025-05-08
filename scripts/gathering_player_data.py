import csv
import requests
from bs4 import BeautifulSoup
import pandas as pd


def main():
    all = pd.DataFrame(columns=['name', 'position', 'id', 'PPR', 'halfPPR', 'standard', 'team', 'bye'])

    non_ppr_url = "https://www.draftsharks.com/rankings/"
    half_ppr_url = "https://www.draftsharks.com/rankings/half-ppr"
    ppr_url = "https://www.draftsharks.com/rankings/ppr"

    non_ppr_soup, half_ppr_soup, ppr_soup = initialize_soups(non_ppr_url, half_ppr_url, ppr_url)

    non_ppr_players = get_player_names(non_ppr_soup)


    for player in non_ppr_players:
        print(player)


def initialize_soups(non_ppr_url,half_ppr_url,ppr_url):
    non_ppr = requests.get(non_ppr_url)
    half_ppr = requests.get(half_ppr_url)
    ppr = requests.get(ppr_url)

    non_ppr_soup = BeautifulSoup(non_ppr.text, 'html.parser')
    half_ppr_soup = BeautifulSoup(half_ppr.text, 'html.parser')
    ppr_soup = BeautifulSoup(ppr.text, 'html.parser')

    return non_ppr_soup, half_ppr_soup, ppr_soup

def get_player_names(soup):
    return [a.get_text(strip=True) for a in soup.find_all('a', class_='player-link')]

if __name__ == '__main__':
    main()
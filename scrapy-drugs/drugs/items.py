# -*- coding: utf-8 -*-

# Define here the models for your scraped items
#
# See documentation in:
# http://doc.scrapy.org/en/latest/topics/items.html

import scrapy


class DrugsItem(scrapy.Item):
    # define the fields for your item here like:
    page_url = scrapy.Field()

    rusname = scrapy.Field()
    latname = scrapy.Field()
    active_component = scrapy.Field()
    atc_code = scrapy.Field()
    tn_content = scrapy.Field()

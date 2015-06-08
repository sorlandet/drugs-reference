# coding=utf8

import os
import re

import scrapy
from scrapy.http.request import Request
from scrapy.selector import Selector

from drugs.items import DrugsItem


def removeNonAsciiFromYears(s):
    # return "".join(filter(lambda x: ord(x) < 128, s))
    ret = []
    for i in s:
        if ord(i) > 128 or i == '.':
            i = ' '
        ret.append(i)
    return "".join(ret)

class RlsnetSpider(scrapy.Spider):
    name = "rlsnet"
    allowed_domains = ["rlsnet.ru"]
    page_url = None
    car = None
    make = None
    model = None

    def __init__(self, filename=None, *args, **kwargs):
        super(RlsnetSpider, self).__init__(*args, **kwargs)
        self.start_urls = []
        # ?nocache=yes
        # with open(filename, 'r') as f:
        #     lines = f.readlines()
        #     for line in lines:
        #         data = re.findall('<loc>(http:\/\/.+)<\/loc>', line)
        #         for url in data:
        #             self.start_urls.append(url)

        self.start_urls.append('http://pda.rlsnet.ru/tn_index_id_468.htm')

    def parse(self, response):
        regex = re.compile('<span part=\"rusname\">(?P<rusname>(.+?))</span> <span part=\"latname\">(?P<latname>(.+?))</span> ',re.MULTILINE|re.UNICODE)
        r = regex.search(response.body)
        print r
        print r.groupdict()
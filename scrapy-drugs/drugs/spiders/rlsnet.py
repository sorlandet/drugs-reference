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

    #
    # scrapy crawl rlsnet -a filename=sitemap2.xml
    #
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

        self.start_urls.append('http://www.rlsnet.ru/tn_index_id_468.htm')

    def parse(self, response):
        body = response.body.decode('cp1251').encode('utf8')
        regex = re.compile('<span part=\"rusname\">(?P<rusname>(.+?))</span> <span part=\"latname\">(?P<latname>(.+?))</span> ',re.MULTILINE|re.UNICODE)
        r = regex.search(body)
        if r:
            item = DrugsItem()
            item["page_url"] = response.url

            item["rusname"] = r.groupdict()['rusname'].strip()
            item["latname"] = r.groupdict()['latname'].replace('(', '').replace(')', '').strip()

            hxs = Selector(response)

            item["active_component"] = hxs.xpath('//a[@name="dejstvuyushhee-veshhestvo"]/following-sibling::*[2]/text()').extract()[0]

            item["atc_code"] = hxs.xpath('//a[@name="atx"]/following-sibling::*[2]/text()').extract()[0]

            item["tn_content"] = hxs.xpath('//table/tr/td[@id="tn_content"]').extract()[0]

            # item["status"] = 'raw'
            yield item


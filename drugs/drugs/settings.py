# -*- coding: utf-8 -*-

# Scrapy settings for drugs project
#
# For simplicity, this file contains only the most important settings by
# default. All the other settings are documented here:
#
#     http://doc.scrapy.org/en/latest/topics/settings.html
#

BOT_NAME = 'drugs'

SPIDER_MODULES = ['drugs.spiders']
NEWSPIDER_MODULE = 'drugs.spiders'

USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9A334 Safari/7534.48.3'

ITEM_PIPELINES = {
    'drugs.pipelines.DrugsPipeline': 300
}

DATABASE = {
    'drivername': 'mysql',
    'host': '',
    'port': '3306',
    'username': 'root',
    'password': 'pswd1234',
    'database': 'drugs'
}
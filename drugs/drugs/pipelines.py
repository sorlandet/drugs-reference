# -*- coding: utf-8 -*-

# Define your item pipelines here
#
# Don't forget to add your pipeline to the ITEM_PIPELINES setting
# See: http://doc.scrapy.org/en/latest/topics/item-pipeline.html


from sqlalchemy.orm import sessionmaker

from models import db_connect, create_deals_table, Drug


class DrugsPipeline(object):

    def __init__(self):
        super(DrugsPipeline, self).__init__()
        engine = db_connect()
        create_deals_table(engine)
        self.Session = sessionmaker(bind=engine)

    def process_item(self, item, spider):
        session = self.Session()

        drug = Drug(**item)
        drug.status = 0

        try:
            session.add(drug)
            session.commit()
        except:
            session.rollback()
        finally:
            session.close()

        return item

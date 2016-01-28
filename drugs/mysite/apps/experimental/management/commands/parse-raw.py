import re

from lxml import html

from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.utils.encoding import smart_text

from mysite.apps.experimental.models import Raw, ActiveComponent


PATTERN_ACTIVE_COMPONENTS = re.compile(ur'(?P<ru>.*)(?= \((?P<en>.*)\))')


class Command(BaseCommand):

    def handle(self, *args, **options):
        i = 1
        for raw in Raw.objects.all():
            print i, raw.url

            tree = html.document_fromstring(smart_text(raw.context, encoding='cp1251'))

            self.parse_active_components(raw, tree)

            i += 1


    def parse_active_components(self, raw, tree):

        for text in tree.xpath('//a[@name="dejstvuyushhee-veshhestvo"]/following-sibling::*[2]/text()'):

            matches = re.search(PATTERN_ACTIVE_COMPONENTS, text)
            if matches:
                ru = matches.group('ru').split(' + ')
                en = matches.group('en').split(' + ')
                if len(ru) == len(en):
                    for i, item in enumerate(ru):
                        instance = ActiveComponent(raw=raw, title_orig=en[i], title_rus=ru[i])
                        try:
                            instance.save()
                        except IntegrityError:
                            pass
                    raw.phase1 = True
                else:
                    raw.phase1 = False
            else:
                raw.phase1 = False

            raw.save()



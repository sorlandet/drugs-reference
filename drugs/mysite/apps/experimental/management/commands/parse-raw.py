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
            self.parse_atc_code(raw, tree)

            i += 1

    def parse_active_components(self, raw, tree):
        raw.phase1 = False  # flag that we check for active components

        for text in tree.xpath('//a[@name="dejstvuyushhee-veshhestvo"]/following-sibling::*[2]/text()'):
            raw.active_components = unicode(text)
            raw.phase1 = True  # flag that we get active components

            matches = re.search(PATTERN_ACTIVE_COMPONENTS, text)
            if matches:
                raw.phase2 = True  # flag that we process active components and all is fine

                ru = matches.group('ru').split('+')
                en = matches.group('en').split('+')
                if len(ru) == len(en):
                    for i, item in enumerate(ru):
                        instance = ActiveComponent(raw=raw, title_orig=en[i].strip(), title_rus=ru[i].strip())
                        try:
                            instance.save()
                        except IntegrityError:
                            pass
                else:
                    raw.phase2 = False # flag that we exprerienced some problems with parsing
            else:
                raw.phase2 = False  # flag that we exprerienced some problems with parsing

        raw.save()

    def parse_atc_code(self, raw, tree):
        raw.phase3 = False  # flag that we check for atc code

        for text in tree.xpath('//a[@name="atx"]/following-sibling::*[2]/text()'):
            raw.atc_code = unicode(text)
            raw.phase3 = True  # flag that we get atc code

        raw.save()

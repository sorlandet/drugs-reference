from django.core.management.base import BaseCommand
from django.db import IntegrityError

from mysite.apps.experimental.models import Raw


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument('path', type=str)

    def handle(self, *args, **options):
        path = options.get('path')

        f = open(path)

        i = 0
        for line in f:
            # if i > 7:
            #     break

            try:
                title_orig, title_rus, context, url = line.split('\',\'')
                title_orig = title_orig[1:]
                url = url.replace('\r', '').replace('\n', '')[:-2]
            except ValueError:
                continue

            print i

            instance = Raw(title_orig=title_orig, title_rus=title_rus, context=context, url=url)
            try:
                instance.save()
            except IntegrityError:
                pass

            i += 1




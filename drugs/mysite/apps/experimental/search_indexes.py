from haystack import indexes

from mysite.apps.experimental.models import Raw


class RawIndex(indexes.SearchIndex, indexes.Indexable):
    text = indexes.CharField(document=True, use_template=True)  # field is the primary field for searching within
    alf_en = indexes.CharField(model_attr='alf_en')  # to provide additional filtering options for english
    alf_ru = indexes.CharField(model_attr='alf_ru')  # to provide additional filtering options for russian

    def get_model(self):
        return Raw

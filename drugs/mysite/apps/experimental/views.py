from django.views.generic import TemplateView


class IndexView(TemplateView):
    template_name = 'pages/index.html'


class SearchView(TemplateView):
    template_name = 'pages/search.html'


class AlphabetView(TemplateView):
    template_name = 'pages/alphabet.html'

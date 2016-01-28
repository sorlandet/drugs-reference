from django.contrib import admin

from .models import Raw, ActiveComponent


class ActiveComponentInline(admin.StackedInline):
    model = ActiveComponent
    extra = 3

class RawAdmin(admin.ModelAdmin):
    list_filter = ['phase1']
    list_display = ['title_orig', 'title_rus', 'url', 'phase1']
    fields = ['title_orig', 'title_rus', 'context', 'url']
    search_fields = ['title_orig', 'title_rus']

    inlines = [ActiveComponentInline]

admin.site.register(Raw, RawAdmin)

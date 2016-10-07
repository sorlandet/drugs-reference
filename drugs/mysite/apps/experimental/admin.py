from django.contrib import admin

from .models import Raw, ActiveComponent


class ActiveComponentInline(admin.StackedInline):
    model = ActiveComponent
    extra = 0


class RawAdmin(admin.ModelAdmin):
    list_filter = ['phase1', 'phase2', 'phase3']
    list_display = ['title_orig', 'title_rus', 'alf_en', 'alf_ru', 'url', 'phase1', 'phase2', 'phase3']
    fields = ['title_orig', 'title_rus', 'context', 'url', 'active_components', 'atc_code']
    search_fields = ['title_orig', 'title_rus']

    inlines = [ActiveComponentInline]

admin.site.register(Raw, RawAdmin)

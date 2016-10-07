from django.db import models


class Raw(models.Model):
    title_orig = models.CharField(max_length=255)
    title_rus = models.CharField(max_length=255)

    alf_en = models.CharField(max_length=2, null=True)
    alf_ru = models.CharField(max_length=2, null=True)

    context = models.TextField()
    url = models.CharField(max_length=255, unique=True)

    active_components = models.TextField(null=True)
    atc_code = models.CharField(max_length=255, null=True)

    phase1 = models.NullBooleanField(help_text='for active components gathering')
    phase2 = models.NullBooleanField(help_text='for active components gathering')
    phase3 = models.NullBooleanField(help_text='for atc code gathering')
    phase4 = models.NullBooleanField()
    phase5 = models.NullBooleanField()
    phase6 = models.NullBooleanField()


class ActiveComponent(models.Model):
    raw = models.ForeignKey(Raw)
    title_orig = models.CharField(max_length=255)
    title_rus = models.CharField(max_length=255)

    class Meta:
        unique_together = ('raw', 'title_orig')

    def __unicode__(self):
        return '%s' % self.title_orig

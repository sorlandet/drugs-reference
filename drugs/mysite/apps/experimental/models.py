from django.db import models


class Raw(models.Model):
    title_orig = models.CharField(max_length=255)
    title_rus = models.CharField(max_length=255)
    context = models.TextField()
    url = models.CharField(max_length=255, unique=True)

    phase1 = models.NullBooleanField(help_text='for active components gathering')
    phase2 = models.NullBooleanField()
    phase3 = models.NullBooleanField()
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

# Superseded by ``horsetrader.extractors.static.Static.banner_period``.
#
# UTC periods are now baked onto Banner objects at enrichment time via
# ``Banners._enrichers``; the Timeline pipeline no longer needs a post-hoc
# period-injection step. Pending removal once all confirmed-EN-date event types
# (CMs, scenarios) have equivalent static extractors.
